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
 * Bước của chặng đang chơi:
 * - "solve": chỉ có gợi ý địa điểm, phải gõ đúng tên địa điểm (place = null)
 * - "travel": đã đoán đúng, lộ điểm đến; vào bán kính NEAR_RADIUS_M thì báo server là đã tới
 * - "search": đã tới nơi, lộ gợi ý chỗ giấu mã QR; quét đúng mã là qua chặng
 */
export type StagePhase = "solve" | "travel" | "search";

export type PublicStage = {
  order: number;
  phase: StagePhase;
  /** Gợi ý / câu đố về địa điểm */
  clue: PublicClue;
  /** Điểm đến; null khi chưa đoán đúng */
  place: PublicPlace | null;
  /** Tọa độ để app biết đã vào bán kính chưa; chỉ có ở bước "travel" */
  target: { lat: number; lng: number } | null;
  /** Gợi ý chỗ giấu mã QR; chỉ có ở bước "search" (rỗng nếu Ban tổ chức không ghi gì) */
  qrHint: string | null;
};

/** Tóm tắt chặng đã xong, hiện trên bản đồ màn chơi. Chặng chưa mở không bao giờ có ở đây. */
export type CompletedStage = {
  order: number;
  place: PublicPlace;
  /** Gợi ý đã dẫn tới địa điểm này; null nếu chặng không bắt đầu bằng gợi ý */
  clue: PublicClue | null;
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

export type ArriveResult =
  /** Server xác nhận đã vào bán kính: state.stage.qrHint giờ đã có */
  { ok: true; state: GameState } | { ok: false; reason: "too_far" | "not_ready"; message: string };

export type AnswerResult =
  /** Đoán đúng: state.stage.place giờ là điểm đến của chặng */
  | { ok: true; correct: true; state: GameState }
  | { ok: true; correct: false; message: string }
  | { ok: false; reason: "not_ready"; message: string };
