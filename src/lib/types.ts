/** Những gì trình duyệt được phép thấy. qr_token, mã chữ, tên địa điểm chưa tìm thấy và chặng sau không bao giờ có ở đây. */

/** Vào trong bán kính này quanh điểm đến thì app báo "tìm mã QR bí mật" */
export const NEAR_RADIUS_M = 1000;

/** Gợi ý địa điểm của một chặng (lưu ở cột puzzle_text / puzzle_image_url) */
export type PublicClue = {
  text: string;
  imageUrl: string | null;
};

/** Điểm đến đã lộ: tên, địa chỉ, tọa độ để mở chỉ đường */
export type PublicPlace = {
  title: string;
  address: string;
  lat: number;
  lng: number;
};

/**
 * Chặng đang chơi. Chặng 1 chỉ có gợi ý (place = null): người chơi phải tự đoán.
 * Từ chặng 2, quét được mã của chặng trước là lộ luôn điểm đến (place).
 * lat/lng luôn có để app báo khi vào bán kính NEAR_RADIUS_M.
 */
export type PublicStage = {
  order: number;
  clue: PublicClue;
  place: PublicPlace | null;
  lat: number;
  lng: number;
};

/** Tóm tắt chặng đã xong, hiện trên bản đồ màn chơi. Chặng chưa mở không bao giờ có ở đây. */
export type CompletedStage = {
  order: number;
  place: PublicPlace;
  clue: PublicClue;
  successMessage: string;
};

export type GameStatus = "not_started" | "traveling" | "finished";

export type GameState = {
  serverNow: string;
  player: {
    displayName: string;
    avatarUrl: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  };
  status: GameStatus;
  totalStages: number;
  /** Các chặng đã hoàn thành, theo thứ tự */
  completed: CompletedStage[];
  /** Chặng hiện tại; null khi chưa bắt đầu hoặc đã về đích */
  stage: PublicStage | null;
};

export type ScanResult =
  /** Quét đúng mã của chặng đang chơi: chặng hoàn thành, lộ điểm đến tiếp theo ở state.stage.place (hoặc về đích) */
  | { ok: true; kind: "completed"; order: number; successMessage: string; state: GameState }
  /** Quét lại mã của chặng đã xong: chỉ xem lại */
  | { ok: true; kind: "review"; stage: CompletedStage; state: GameState }
  | { ok: false; reason: "wrong_stage" | "invalid" | "not_started"; message: string };
