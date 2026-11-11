import { normalizeCode } from "@/lib/normalize";
import type {
  CompletedStage,
  GameState,
  GameStatus,
  PublicClue,
  PublicPlace,
  ScanResult,
} from "@/lib/types";
import type { GameStore, PlayerRow, ProgressRow, StageRow } from "./store/types";

export class GameError extends Error {
  constructor(
    public code: "no_player" | "not_found",
    message: string,
  ) {
    super(message);
  }
}

type Ctx = {
  player: PlayerRow;
  stages: StageRow[];
  progress: ProgressRow[];
};

/**
 * Toàn bộ quy tắc chuyển trạng thái chặng: mỗi chặng có một gợi ý địa điểm; quét được
 * mã QR bí mật ở địa điểm đó là hoàn thành chặng và mở chặng sau. Trạng thái luôn được suy ra từ
 * `current_stage` + bảng progress, nên sửa tay `current_stage` trong Table Editor là đủ để mở khóa.
 */
export class Game {
  constructor(
    private store: GameStore,
    private opts: { now?: () => Date } = {},
  ) {}

  private now() {
    return this.opts.now?.() ?? new Date();
  }

  private async load(userId: string): Promise<Ctx> {
    const player = await this.store.getPlayerByUserId(userId);
    if (!player) {
      throw new GameError("no_player", "Tài khoản này chưa được ghi danh vào cuộc đua.");
    }
    const [stages, progress] = await Promise.all([
      this.store.listStages(),
      this.store.listProgress(player.id),
    ]);
    if (stages.length === 0) throw new GameError("not_found", "Cuộc đua chưa có chặng nào.");
    return { player, stages, progress };
  }

  private status(ctx: Ctx): GameStatus {
    const { player, stages } = ctx;
    if (!player.started_at) return "not_started";
    if (player.current_stage > stages.length) return "finished";
    return "traveling";
  }

  private currentStage(ctx: Ctx): StageRow | undefined {
    const n = Math.max(1, ctx.player.current_stage);
    return ctx.stages.find((s) => s.order === n);
  }

  private progressFor(ctx: Ctx, stage: StageRow): ProgressRow | undefined {
    return ctx.progress.find((p) => p.stage_id === stage.id);
  }

  private clueOf(stage: StageRow): PublicClue {
    return { text: stage.puzzle_text, imageUrl: stage.puzzle_image_url };
  }

  private placeOf(stage: StageRow): PublicPlace {
    return { title: stage.title, address: stage.address, lat: stage.lat, lng: stage.lng };
  }

  private summaryOf(stage: StageRow): CompletedStage {
    return {
      order: stage.order,
      place: this.placeOf(stage),
      clue: this.clueOf(stage),
      successMessage: stage.success_message,
    };
  }

  /** Chặng đã xong: địa điểm, gợi ý ban đầu, lời nhắn — cho bảng thông tin màn chơi. */
  private completedOf(ctx: Ctx): CompletedStage[] {
    const { player, stages } = ctx;
    if (!player.started_at) return [];
    return stages.filter((s) => s.order < player.current_stage).map((s) => this.summaryOf(s));
  }

  private toState(ctx: Ctx): GameState {
    const status = this.status(ctx);
    const { player, stages } = ctx;
    const base: GameState = {
      serverNow: this.now().toISOString(),
      player: {
        displayName: player.display_name,
        avatarUrl: player.avatar_url,
        startedAt: player.started_at,
        finishedAt: player.finished_at,
      },
      status,
      totalStages: stages.length,
      completed: this.completedOf(ctx),
      stage: null,
    };
    if (status === "not_started" || status === "finished") return base;
    const stage = this.currentStage(ctx)!;
    base.stage = {
      order: stage.order,
      clue: this.clueOf(stage),
      // Chặng 1 phải tự đoán từ gợi ý; từ chặng 2, mã QR của chặng trước đã chỉ ra điểm đến
      place: stage.order > 1 ? this.placeOf(stage) : null,
      lat: stage.lat,
      lng: stage.lng,
    };
    return base;
  }

  private async upsert(ctx: Ctx, stage: StageRow, patch: Partial<ProgressRow>) {
    const row = await this.store.upsertProgress(ctx.player.id, stage.id, patch);
    ctx.progress = [...ctx.progress.filter((p) => p.stage_id !== stage.id), row];
    return row;
  }

  async getState(userId: string): Promise<GameState> {
    return this.toState(await this.load(userId));
  }

  /** Nút "Bắt đầu cuộc đua": ghi started_at (một lần) và mở chặng 1. */
  async start(userId: string): Promise<GameState> {
    const ctx = await this.load(userId);
    if (!ctx.player.started_at) {
      ctx.player = await this.store.updatePlayer(ctx.player.id, {
        started_at: this.now().toISOString(),
        current_stage: Math.max(1, ctx.player.current_stage),
        status: "traveling",
      });
    }
    return this.toState(ctx);
  }

  /** Nút "Chơi lại từ đầu": xóa tiến độ, về chặng 1, chưa bắt đầu (giống `npm run player:reset`). */
  async reset(userId: string): Promise<GameState> {
    const ctx = await this.load(userId);
    await this.store.clearProgress(ctx.player.id);
    ctx.progress = [];
    ctx.player = await this.store.updatePlayer(ctx.player.id, {
      current_stage: 1,
      status: "traveling",
      started_at: null,
      finished_at: null,
    });
    return this.toState(ctx);
  }

  /** Quét mã: `token` lấy từ link QR, hoặc `code` là mã chữ in dưới QR. */
  async scan(userId: string, input: { token?: string; code?: string }): Promise<ScanResult> {
    const ctx = await this.load(userId);
    const token = extractToken(input.token);
    const code = input.code ? normalizeCode(input.code) : "";
    const stage = ctx.stages.find(
      (s) => (token && s.qr_token === token) || (code && normalizeCode(s.manual_code) === code),
    );
    if (!stage) {
      return {
        ok: false,
        reason: "invalid",
        message: "Mã này không đúng. Hãy quét lại, hoặc nhập mã chữ in dưới QR.",
      };
    }
    const status = this.status(ctx);
    if (status === "not_started") {
      return { ok: false, reason: "not_started", message: "Hãy bấm “Bắt đầu cuộc đua” trước." };
    }
    if (stage.order < ctx.player.current_stage) {
      // Mã của chặng đã xong: chỉ xem lại gợi ý và lời nhắn
      const done = this.completedOf(ctx).find((c) => c.order === stage.order)!;
      return { ok: true, kind: "review", stage: done, state: this.toState(ctx) };
    }
    if (stage.order > ctx.player.current_stage) {
      return {
        ok: false,
        reason: "wrong_stage",
        message: "Mã này của một chặng khác. Hãy tìm mã QR bí mật ở địa điểm trong gợi ý.",
      };
    }
    // Đúng mã của chặng đang chơi: tìm thấy địa điểm → hoàn thành, mở chặng sau
    const now = this.now().toISOString();
    const pr = this.progressFor(ctx, stage);
    await this.upsert(ctx, stage, { scanned_at: pr?.scanned_at ?? now, solved_at: now });
    const next = stage.order + 1;
    const finished = next > ctx.stages.length;
    ctx.player = await this.store.updatePlayer(ctx.player.id, {
      current_stage: next,
      status: finished ? "finished" : "traveling",
      ...(finished ? { finished_at: now } : {}),
    });
    return {
      ok: true,
      kind: "completed",
      order: stage.order,
      successMessage: stage.success_message,
      state: this.toState(ctx),
    };
  }
}

/** Chấp nhận cả link đầy đủ "https://…/q/<token>" lẫn token trần. */
export function extractToken(raw?: string): string {
  if (!raw) return "";
  const s = raw.trim();
  const m = s.match(/\/q\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : "";
}
