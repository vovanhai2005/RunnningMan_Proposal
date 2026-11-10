import { randomUUID } from "node:crypto";
import { clueImageOf, clueOf, type ContentFile } from "@/lib/content";
import type {
  GameStore,
  PlayerPatch,
  PlayerRow,
  ProgressPatch,
  ProgressRow,
  StageRoutePatch,
  StageRow,
} from "./types";

/** Store trong bộ nhớ cho chế độ demo và kiểm thử tự động. */
export class MemoryStore implements GameStore {
  stages: StageRow[];
  players: PlayerRow[] = [];
  progress: ProgressRow[] = [];

  constructor(stages: StageRow[]) {
    this.stages = [...stages].sort((a, b) => a.order - b.order);
  }

  addPlayer(userId: string, displayName: string, avatarUrl: string | null = null): PlayerRow {
    const p: PlayerRow = {
      id: randomUUID(),
      user_id: userId,
      display_name: displayName,
      avatar_url: avatarUrl,
      current_stage: 1,
      status: "traveling",
      started_at: null,
      finished_at: null,
    };
    this.players.push(p);
    return p;
  }

  // Trả về bản sao để hành xử giống cơ sở dữ liệu thật
  async getPlayerByUserId(userId: string) {
    const p = this.players.find((x) => x.user_id === userId);
    return p ? { ...p } : null;
  }
  async listStages() {
    return this.stages.map((s) => ({ ...s }));
  }
  async listProgress(playerId: string) {
    return this.progress.filter((r) => r.player_id === playerId).map((r) => ({ ...r }));
  }
  async updatePlayer(playerId: string, patch: PlayerPatch) {
    const p = this.players.find((x) => x.id === playerId);
    if (!p) throw new Error("player not found");
    Object.assign(p, patch);
    return { ...p };
  }
  async upsertProgress(playerId: string, stageId: string, patch: ProgressPatch) {
    let row = this.progress.find((r) => r.player_id === playerId && r.stage_id === stageId);
    if (!row) {
      row = {
        id: randomUUID(),
        player_id: playerId,
        stage_id: stageId,
        scanned_at: null,
        solved_at: null,
        wrong_attempts: 0,
        hints_shown: 0,
        attempt_window_start: null,
        attempt_window_count: 0,
        route_polyline: null,
        route_distance_m: null,
        route_duration_s: null,
        route_approximate: false,
      };
      this.progress.push(row);
    }
    Object.assign(row, patch);
    return { ...row };
  }
  async updateStageRoute(stageId: string, patch: StageRoutePatch) {
    const s = this.stages.find((x) => x.id === stageId);
    if (s) Object.assign(s, patch);
  }
}

/** Chuyển file nội dung thành các dòng chặng; mã demo là "demo-<thứ tự>" và "RM<thứ tự>". */
export function stagesFromContent(content: ContentFile): StageRow[] {
  return content.stages.map((s) => ({
    id: `stage-${s.order}`,
    order: s.order,
    title: s.title,
    lat: s.lat!,
    lng: s.lng!,
    qr_token: `demo-${s.order}`,
    manual_code: `RM${s.order}`,
    puzzle_text: clueOf(s),
    puzzle_image_url: clueImageOf(s),
    answers: s.answers ?? [],
    hints: s.hints ?? [],
    success_message: s.successMessage,
    route_polyline: null,
    route_distance_m: null,
    route_duration_s: null,
    route_approximate: false,
  }));
}
