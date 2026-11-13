import { haversine } from "@/lib/geo";
import { isCorrectAnswer, normalizeCode } from "@/lib/normalize";
import {
  NEAR_RADIUS_M,
  type AnswerResult,
  type ArriveResult,
  type CompletedStage,
  type GameState,
  type GameStatus,
  type PublicClue,
  type PublicPlace,
  type QuizResult,
  type ScanResult,
  type StagePhase,
} from "@/lib/types";
import type { GameStore, PlayerRow, ProgressRow, StageRow } from "./store/types";
import {
  chapterOf,
  hasRestBefore,
  memoriesOf,
  publicQuiz,
  quizConfigOf,
  restBefore,
} from "./story";

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
 * Toàn bộ quy tắc chuyển trạng thái chặng. Mỗi chặng có 3 bước:
 * 1. "solve"  — gợi ý địa điểm; gõ đúng một trong `answers` thì lộ điểm đến (progress.solved_at)
 * 2. "travel" — đi tới điểm đến; vào bán kính NEAR_RADIUS_M thì lộ gợi ý chỗ giấu mã QR
 *               (progress.hints_shown = 1; cột cũ, giờ dùng làm cờ "đã tới nơi")
 * 3. "search" — quét được mã QR bí mật là hoàn thành chặng và mở chặng sau
 * Chặng không có `answers` thì bỏ qua bước 1 (vẫn chỉ hiện gợi ý, không lộ tên địa điểm). Quét đúng mã ở bước nào cũng qua chặng (dự phòng).
 * Trạng thái luôn được suy ra từ `current_stage` + bảng progress, nên sửa tay `current_stage`
 * trong Table Editor là đủ để mở khóa.
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

  /** Gợi ý chỗ giấu mã QR (cột `hints`, phần tử đầu) */
  private qrHintOf(stage: StageRow): string {
    return stage.hints[0] ?? "";
  }

  private phaseOf(ctx: Ctx, stage: StageRow): StagePhase {
    const pr = this.progressFor(ctx, stage);
    // progress.attempt_window_start: cột cũ, giờ là thời điểm nghỉ xong ở trạm nghỉ trước chặng
    if (hasRestBefore(stage.order) && !pr?.attempt_window_start && !pr?.scanned_at) return "rest";
    // Chặng có câu hỏi: quét mã xong (scanned_at) mà vẫn là chặng hiện tại = đang chờ trả lời
    if (quizConfigOf(stage.order) && pr?.scanned_at) return "quiz";
    if (stage.answers.length > 0 && !pr?.solved_at) return "solve";
    return (pr?.hints_shown ?? 0) > 0 ? "search" : "travel";
  }

  private summaryOf(stage: StageRow): CompletedStage {
    return {
      order: stage.order,
      place: this.placeOf(stage),
      clue: stage.puzzle_text ? this.clueOf(stage) : null,
      successMessage: stage.success_message,
      chapter: chapterOf(stage.order),
      rest: restBefore(stage.order, true),
      memories: memoriesOf(stage.order),
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
    const phase = this.phaseOf(ctx, stage);
    // Có gợi ý mà chưa nhập đáp án (hoặc chưa `content:push` đáp án) thì không bao giờ lộ địa điểm:
    // người chơi tự đoán từ gợi ý rồi đi tới, như kiểu chơi cũ.
    // Đang ở trạm nghỉ: màn không có gợi ý (3, 4) vẫn lộ điểm đến ngay khi quét mã màn trước
    const hidden = phase === "solve" || (stage.answers.length === 0 && !!stage.puzzle_text);
    base.stage = {
      order: stage.order,
      phase,
      clue: this.clueOf(stage),
      place: hidden ? null : this.placeOf(stage),
      target: phase === "travel" ? { lat: stage.lat, lng: stage.lng } : null,
      qrHint: phase === "search" ? this.qrHintOf(stage) : null,
      chapter: chapterOf(stage.order),
      rest: restBefore(stage.order, phase !== "rest"),
      quiz: null,
    };
    const quiz = quizConfigOf(stage.order);
    const scannedAt = this.progressFor(ctx, stage)?.scanned_at;
    if (phase === "quiz" && quiz && scannedAt) {
      base.stage.quiz = publicQuiz(quiz, scannedAt, this.now());
    }
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

  /** Nút "Nghỉ xong, lên đường" ở trạm nghỉ: mở chặng ngay sau trạm. */
  async finishRest(userId: string): Promise<GameState> {
    const ctx = await this.load(userId);
    const stage = this.status(ctx) === "traveling" ? this.currentStage(ctx) : undefined;
    if (stage && this.phaseOf(ctx, stage) === "rest") {
      await this.upsert(ctx, stage, { attempt_window_start: this.now().toISOString() });
    }
    return this.toState(ctx);
  }

  /** Ô "Đó là đâu?": gõ đúng tên địa điểm thì lộ điểm đến của chặng đang chơi. */
  async answer(userId: string, text: string): Promise<AnswerResult> {
    const ctx = await this.load(userId);
    if (this.status(ctx) !== "traveling") {
      return { ok: false, reason: "not_ready", message: "Không có gợi ý nào đang chờ trả lời." };
    }
    const stage = this.currentStage(ctx)!;
    if (this.phaseOf(ctx, stage) !== "solve") {
      return { ok: true, correct: true, state: this.toState(ctx) };
    }
    const pr = this.progressFor(ctx, stage);
    if (isCorrectAnswer(text, stage.answers)) {
      await this.upsert(ctx, stage, { solved_at: this.now().toISOString() });
      return { ok: true, correct: true, state: this.toState(ctx) };
    }
    await this.upsert(ctx, stage, { wrong_attempts: (pr?.wrong_attempts ?? 0) + 1 });
    return {
      ok: true,
      correct: false,
      message: "Chưa phải địa điểm này. Đọc lại gợi ý rồi thử tên khác nhé.",
    };
  }

  /** App báo đã vào bán kính quanh điểm đến; server tự đo lại khoảng cách trước khi lộ gợi ý mã QR. */
  async arrive(userId: string, pos: { lat: number; lng: number }): Promise<ArriveResult> {
    const ctx = await this.load(userId);
    const stage = this.status(ctx) === "traveling" ? this.currentStage(ctx)! : undefined;
    const phase = stage && this.phaseOf(ctx, stage);
    if (!stage || phase === "rest" || phase === "solve") {
      return { ok: false, reason: "not_ready", message: "Hãy đoán ra địa điểm trước." };
    }
    if (phase === "search") return { ok: true, state: this.toState(ctx) };
    if (haversine(pos, stage) > NEAR_RADIUS_M) {
      return { ok: false, reason: "too_far", message: "Bạn chưa vào vòng 1 km quanh điểm đến." };
    }
    await this.upsert(ctx, stage, { hints_shown: 1 });
    return { ok: true, state: this.toState(ctx) };
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
    if (quizConfigOf(stage.order)) {
      // Còn một câu hỏi: giữ lần quét đầu để đồng hồ mở gợi ý không bị đặt lại khi quét lại
      await this.upsert(ctx, stage, {
        scanned_at: pr?.scanned_at ?? now,
        solved_at: pr?.solved_at ?? now,
      });
      return { ok: true, kind: "quiz", state: this.toState(ctx) };
    }
    await this.upsert(ctx, stage, { scanned_at: now, solved_at: pr?.solved_at ?? now });
    return this.complete(ctx, stage);
  }

  /** Câu hỏi sau khi quét mã: trả lời đúng là hoàn thành chặng. */
  async quiz(userId: string, text: string): Promise<QuizResult> {
    const ctx = await this.load(userId);
    const stage = this.status(ctx) === "traveling" ? this.currentStage(ctx) : undefined;
    const cfg = stage && quizConfigOf(stage.order);
    if (!stage || !cfg || this.phaseOf(ctx, stage) !== "quiz") {
      return { ok: false, reason: "not_ready", message: "Hãy quét mã QR trước để nhận câu hỏi." };
    }
    if (isCorrectAnswer(text, cfg.answers)) {
      const r = await this.complete(ctx, stage);
      return { ok: true, correct: true, order: r.order, successMessage: r.successMessage, state: r.state };
    }
    const pr = this.progressFor(ctx, stage);
    await this.upsert(ctx, stage, { wrong_attempts: (pr?.wrong_attempts ?? 0) + 1 });
    return { ok: true, correct: false, message: "Chưa đúng rồi. Nghĩ thêm chút nữa nhé!" };
  }

  /** Hoàn thành chặng đang chơi: mở chặng sau, hoặc về đích nếu là chặng cuối */
  private async complete(ctx: Ctx, stage: StageRow) {
    const now = this.now().toISOString();
    const next = stage.order + 1;
    const finished = next > ctx.stages.length;
    ctx.player = await this.store.updatePlayer(ctx.player.id, {
      current_stage: next,
      status: finished ? "finished" : "traveling",
      ...(finished ? { finished_at: now } : {}),
    });
    return {
      ok: true as const,
      kind: "completed" as const,
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
