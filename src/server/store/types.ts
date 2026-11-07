import type { Pt } from "@/lib/geo";

/** Dòng bảng `stages` — chỉ server đọc được (RLS không có policy cho người chơi). */
export type StageRow = {
  id: string;
  order: number;
  title: string;
  lat: number;
  lng: number;
  qr_token: string;
  manual_code: string;
  puzzle_text: string;
  puzzle_image_url: string | null;
  answers: string[];
  hints: string[];
  success_message: string;
  route_polyline: Pt[] | null;
  route_distance_m: number | null;
  route_duration_s: number | null;
  route_approximate: boolean;
};

export type PlayerStatus = "traveling" | "solving" | "finished";

export type PlayerRow = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  current_stage: number;
  status: PlayerStatus;
  started_at: string | null;
  finished_at: string | null;
};

export type ProgressRow = {
  id: string;
  player_id: string;
  stage_id: string;
  scanned_at: string | null;
  solved_at: string | null;
  wrong_attempts: number;
  hints_shown: number;
  attempt_window_start: string | null;
  attempt_window_count: number;
  /** Tuyến riêng của người chơi — dùng cho chặng 1 (tính từ vị trí lúc bấm "Bắt đầu") */
  route_polyline: Pt[] | null;
  route_distance_m: number | null;
  route_duration_s: number | null;
  route_approximate: boolean;
};

export type StageRoutePatch = Pick<
  StageRow,
  "route_polyline" | "route_distance_m" | "route_duration_s" | "route_approximate"
>;
export type ProgressPatch = Partial<Omit<ProgressRow, "id" | "player_id" | "stage_id">>;
export type PlayerPatch = Partial<Omit<PlayerRow, "id" | "user_id">>;

export interface GameStore {
  getPlayerByUserId(userId: string): Promise<PlayerRow | null>;
  /** Mọi chặng, sắp theo `order` tăng dần */
  listStages(): Promise<StageRow[]>;
  listProgress(playerId: string): Promise<ProgressRow[]>;
  updatePlayer(playerId: string, patch: PlayerPatch): Promise<PlayerRow>;
  upsertProgress(playerId: string, stageId: string, patch: ProgressPatch): Promise<ProgressRow>;
  updateStageRoute(stageId: string, patch: StageRoutePatch): Promise<void>;
}
