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
  /** null khi chỉ có địa chỉ (Google Maps sẽ tìm theo địa chỉ) */
  lat: number | null;
  lng: number | null;
};

/**
 * Bước của chặng đang chơi:
 * - "rest": đang ở trạm nghỉ trước chặng này; chưa lộ gì về chặng
 * - "solve": chỉ có gợi ý địa điểm, phải gõ đúng tên địa điểm (place = null)
 * - "travel": đã đoán đúng, lộ điểm đến; vào bán kính NEAR_RADIUS_M thì báo server là đã tới
 * - "search": đã tới nơi, lộ gợi ý chỗ giấu mã QR; quét đúng mã là qua chặng
 * - "quiz": đã quét mã, còn một câu hỏi; trả lời đúng mới qua chặng
 */
export type StagePhase = "rest" | "solve" | "travel" | "search" | "quiz";

/**
 * Câu hỏi sau khi quét mã (chặng cuối): trả lời đúng mới hoàn thành chặng.
 * Gợi ý chỉ được gửi xuống khi đã qua `hintAt` mà chưa trả lời đúng.
 */
export type PublicQuiz = {
  question: string;
  /** Thời điểm mở gợi ý (ISO, theo đồng hồ server) */
  hintAt: string;
  /** null cho tới `hintAt` */
  hint: string | null;
};

/**
 * Trạm nghỉ chen giữa hai chặng (vd. "Chặng 2.5" trước chặng 3). Không phải chặng riêng nên
 * không có mã QR; bấm "Nghỉ xong, lên đường" là mở chặng sau.
 */
export type PublicRest = {
  /** Nhãn dán, vd. "Chặng 2.5" */
  label: string;
  /** Tiêu đề màn mở đầu trạm nghỉ */
  heading: string;
  /** Lời nhắn cho người chơi */
  note: string;
  place: PublicPlace;
  /** Đã nghỉ xong (chặng sau đã mở) */
  done: boolean;
};

/** Tên chặng, hiện ở màn mở đầu chặng. `numbered: false` thì chỉ hiện câu, không ghi "Chặng N". */
export type Chapter = {
  title: string;
  numbered: boolean;
};

/** Ảnh / video kỷ niệm của một chặng; chỉ gửi xuống khi chặng đã xong */
export type Memory = {
  kind: "photo" | "video";
  src: string;
  /** Ảnh nhỏ (cạnh dài 320px) cho nút xem lại */
  thumb: string;
  /** Ảnh bìa của video; null với ảnh */
  poster: string | null;
  width: number;
  height: number;
};

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
  /** Tên chặng cho màn mở đầu; null nếu chặng không có tên */
  chapter: Chapter | null;
  /** Trạm nghỉ ngay trước chặng này (nếu có) */
  rest: PublicRest | null;
  /** Câu hỏi sau khi quét mã; chỉ có ở bước "quiz" */
  quiz: PublicQuiz | null;
};

/** Tóm tắt chặng đã xong, hiện trên bản đồ màn chơi. Chặng chưa mở không bao giờ có ở đây. */
export type CompletedStage = {
  order: number;
  place: PublicPlace;
  /** Gợi ý đã dẫn tới địa điểm này; null nếu chặng không bắt đầu bằng gợi ý */
  clue: PublicClue | null;
  successMessage: string;
  chapter: Chapter | null;
  /** Trạm nghỉ ngay trước chặng này (nếu có), đã nghỉ xong */
  rest: PublicRest | null;
  /** Ảnh kỷ niệm mở ra khi quét được mã của chặng này (có thể rỗng) */
  memories: Memory[];
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
  /** Quét đúng mã của chặng có câu hỏi: hiện câu hỏi (state.stage.quiz), chưa qua chặng */
  | { ok: true; kind: "quiz"; state: GameState }
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

export type QuizResult =
  /** Trả lời đúng: chặng hoàn thành (giống quét mã ở chặng thường) */
  | { ok: true; correct: true; order: number; successMessage: string; state: GameState }
  | { ok: true; correct: false; message: string }
  | { ok: false; reason: "not_ready"; message: string };
