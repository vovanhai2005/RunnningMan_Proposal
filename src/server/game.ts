import type { LatLng } from "@/lib/geo";
import { isCorrectAnswer, normalizeCode } from "@/lib/normalize";
import { computeRouteOrFallback, type ComputedRoute } from "@/lib/routes-api";
import type {
  AnswerResult,
  GameState,
  GameStatus,
  PublicPuzzle,
  PublicRoute,
  ScanResult,
} from "@/lib/types";
import type { GameStore, PlayerRow, ProgressRow, StageRow } from "./store/types";

/** Số lần sai trước khi mở thêm một gợi ý (mục 6.5) */
export const WRONG_PER_HINT = 3;
/** Giới hạn khoảng 10 lần thử mỗi phút */
export const MAX_ATTEMPTS_PER_MINUTE = 10;

export class GameError extends Error {
  constructor(
    public code: "no_player" | "not_found",
    message: string,
  ) {
    super(message);
  }
}

export type Router = (origin: LatLng, destination: LatLng) => Promise<ComputedRoute>;

type Ctx = {
  player: PlayerRow;
  stages: StageRow[];
  progress: ProgressRow[];
};

/**
 * Toàn bộ quy tắc chuyển trạng thái chặng (mục 6). Trạng thái luôn được suy ra từ
 * `current_stage` + bảng progress, nên sửa tay `current_stage` trong Table Editor là đủ để mở khóa.
 */
export class Game {
  constructor(
    private store: GameStore,
    private opts: { router?: Router; now?: () => Date } = {},
  ) {}

  private route(origin: LatLng, destination: LatLng) {
    return (this.opts.router ?? computeRouteOrFallback)(origin, destination);
  }

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
    const cur = this.currentStage(ctx);
    const pr = cur && this.progressFor(ctx, cur);
    return pr?.scanned_at && !pr.solved_at ? "solving" : "traveling";
  }

  private currentStage(ctx: Ctx): StageRow | undefined {
    const n = Math.max(1, ctx.player.current_stage);
    return ctx.stages.find((s) => s.order === n);
  }

  private progressFor(ctx: Ctx, stage: StageRow): ProgressRow | undefined {
    return ctx.progress.find((p) => p.stage_id === stage.id);
  }

  private puzzleOf(stage: StageRow, pr: ProgressRow | undefined, readOnly: boolean): PublicPuzzle {
    const shown = readOnly ? stage.hints.length : (pr?.hints_shown ?? 0);
    return {
      order: stage.order,
      title: stage.title,
      text: stage.puzzle_text,
      imageUrl: stage.puzzle_image_url,
      hints: stage.hints.slice(0, shown),
      wrongAttempts: pr?.wrong_attempts ?? 0,
      readOnly,
      ...(readOnly ? { successMessage: stage.success_message } : {}),
    };
  }

  /** Tuyến của chặng: chặng 1 lưu theo người chơi; chặng sau tính từ điểm chặng trước. */
  private async routeOf(ctx: Ctx, stage: StageRow): Promise<PublicRoute | null> {
    if (stage.order === 1) {
      const pr = this.progressFor(ctx, stage);
      if (!pr?.route_polyline) return null;
      return {
        points: pr.route_polyline,
        distanceM: pr.route_distance_m ?? 0,
        durationS: pr.route_duration_s ?? 0,
        approximate: pr.route_approximate,
      };
    }
    if (!stage.route_polyline) {
      // Chưa chạy `npm run content:push`: tính một lần rồi lưu lại.
      const prev = ctx.stages.find((s) => s.order === stage.order - 1);
      if (!prev) return null;
      const r = await this.route(prev, stage);
      const patch = {
        route_polyline: r.points,
        route_distance_m: r.distanceM,
        route_duration_s: r.durationS,
        route_approximate: r.approximate,
      };
      await this.store.updateStageRoute(stage.id, patch);
      Object.assign(stage, patch);
    }
    return {
      points: stage.route_polyline!,
      distanceM: stage.route_distance_m ?? 0,
      durationS: stage.route_duration_s ?? 0,
      approximate: stage.route_approximate,
    };
  }

  private async toState(ctx: Ctx): Promise<GameState> {
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
      stage: null,
      puzzle: null,
    };
    if (status === "not_started" || status === "finished") return base;
    const stage = this.currentStage(ctx)!;
    const pr = this.progressFor(ctx, stage);
    base.stage = {
      order: stage.order,
      title: stage.title,
      lat: stage.lat,
      lng: stage.lng,
      route: await this.routeOf(ctx, stage),
      scanned: !!pr?.scanned_at,
    };
    if (status === "solving") base.puzzle = this.puzzleOf(stage, pr, false);
    return base;
  }

  private async syncStatus(ctx: Ctx) {
    const s = this.status(ctx);
    if (s !== "not_started" && s !== ctx.player.status) {
      ctx.player = await this.store.updatePlayer(ctx.player.id, { status: s });
    }
  }

  private async upsert(ctx: Ctx, stage: StageRow, patch: Partial<ProgressRow>) {
    const row = await this.store.upsertProgress(ctx.player.id, stage.id, patch);
    ctx.progress = [...ctx.progress.filter((p) => p.stage_id !== stage.id), row];
    return row;
  }

  async getState(userId: string): Promise<GameState> {
    return this.toState(await this.load(userId));
  }

  /** Nút "Bắt đầu cuộc đua": ghi started_at (một lần) và tính tuyến chặng 1 từ vị trí hiện tại. */
  async start(userId: string, pos?: LatLng | null): Promise<GameState> {
    const ctx = await this.load(userId);
    if (!ctx.player.started_at) {
      ctx.player = await this.store.updatePlayer(ctx.player.id, {
        started_at: this.now().toISOString(),
        current_stage: Math.max(1, ctx.player.current_stage),
        status: "traveling",
      });
    }
    if (pos) await this.ensureStage1Route(ctx, pos);
    return this.toState(ctx);
  }

  /** Gọi lại khi lúc bấm "Bắt đầu" chưa có vị trí (ví dụ vừa cấp quyền sau). */
  async planRoute(userId: string, pos: LatLng): Promise<GameState> {
    const ctx = await this.load(userId);
    await this.ensureStage1Route(ctx, pos);
    return this.toState(ctx);
  }

  private async ensureStage1Route(ctx: Ctx, pos: LatLng) {
    const stage1 = ctx.stages.find((s) => s.order === 1);
    if (!stage1 || ctx.player.current_stage !== 1 || !ctx.player.started_at) return;
    const pr = this.progressFor(ctx, stage1);
    // Đã có tuyến thật thì không tính lại; tuyến ước lượng thì thử tính lại đường thật
    if (pr?.route_polyline && !pr.route_approximate) return;
    const r = await this.route(pos, stage1);
    if (pr?.route_polyline && r.approximate) return;
    await this.upsert(ctx, stage1, {
      route_polyline: r.points,
      route_distance_m: r.distanceM,
      route_duration_s: r.durationS,
      route_approximate: r.approximate,
    });
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
      return { ok: false, reason: "not_started", message: "Hãy bấm “Bắt đầu cuộc đua” trước nhé." };
    }
    if (stage.order < ctx.player.current_stage) {
      // Mã của chặng đã xong: mở lại câu đố ở chế độ chỉ xem
      return {
        ok: true,
        state: await this.toState(ctx),
        puzzle: this.puzzleOf(stage, this.progressFor(ctx, stage), true),
      };
    }
    if (stage.order > ctx.player.current_stage) {
      return {
        ok: false,
        reason: "wrong_stage",
        message: "Đây không phải mã của chặng này.",
      };
    }
    let pr = this.progressFor(ctx, stage);
    if (!pr?.scanned_at) {
      pr = await this.upsert(ctx, stage, { scanned_at: this.now().toISOString() });
    }
    await this.syncStatus(ctx);
    return { ok: true, state: await this.toState(ctx), puzzle: this.puzzleOf(stage, pr, false) };
  }

  async answer(userId: string, text: string): Promise<AnswerResult> {
    const ctx = await this.load(userId);
    if (this.status(ctx) !== "solving") {
      return {
        ok: false,
        reason: "not_scanned",
        message: "Hãy quét mã tại điểm đến để nhận câu đố.",
        state: await this.toState(ctx),
      };
    }
    const stage = this.currentStage(ctx)!;
    const pr = this.progressFor(ctx, stage)!;
    const now = this.now();

    // Giới hạn số lần thử theo cửa sổ 60 giây
    const windowStart = pr.attempt_window_start ? new Date(pr.attempt_window_start) : null;
    const inWindow = windowStart && now.getTime() - windowStart.getTime() < 60_000;
    const count = inWindow ? pr.attempt_window_count : 0;
    if (count >= MAX_ATTEMPTS_PER_MINUTE) {
      return {
        ok: false,
        reason: "rate_limited",
        message: "Bạn thử nhanh quá! Nghỉ một chút rồi trả lời tiếp nhé.",
      };
    }
    const rate = {
      attempt_window_start: inWindow ? pr.attempt_window_start : now.toISOString(),
      attempt_window_count: count + 1,
    };

    if (isCorrectAnswer(text, stage.answers)) {
      await this.upsert(ctx, stage, { ...rate, solved_at: now.toISOString() });
      const next = stage.order + 1;
      const finished = next > ctx.stages.length;
      ctx.player = await this.store.updatePlayer(ctx.player.id, {
        current_stage: next,
        status: finished ? "finished" : "traveling",
        ...(finished ? { finished_at: now.toISOString() } : {}),
      });
      return {
        ok: true,
        correct: true,
        successMessage: stage.success_message,
        state: await this.toState(ctx),
      };
    }

    const wrong = pr.wrong_attempts + 1;
    const prevHints = pr.hints_shown;
    const hintsShown = Math.min(stage.hints.length, Math.floor(wrong / WRONG_PER_HINT));
    const row = await this.upsert(ctx, stage, {
      ...rate,
      wrong_attempts: wrong,
      hints_shown: Math.max(prevHints, hintsShown),
    });
    return {
      ok: true,
      correct: false,
      message: "Chưa đúng rồi, thử lại nhé!",
      puzzle: this.puzzleOf(stage, row, false),
      newHint: row.hints_shown > prevHints,
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
