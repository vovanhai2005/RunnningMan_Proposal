import type { Pt } from "./geo";

/** Những gì trình duyệt được phép thấy. Đáp án, qr_token, chặng sau không bao giờ có ở đây. */

export type PublicRoute = {
  points: Pt[];
  distanceM: number;
  durationS: number;
  /** Đường thẳng ước lượng (không lấy được đường thật) — vẽ nét đứt */
  approximate: boolean;
};

export type PublicPuzzle = {
  order: number;
  title: string;
  text: string;
  imageUrl: string | null;
  /** Gợi ý đã mở (sau mỗi 3 lần sai mở thêm một gợi ý) */
  hints: string[];
  wrongAttempts: number;
  /** Chỉ có ở chế độ chỉ xem (chặng đã xong) */
  successMessage?: string;
  readOnly: boolean;
};

export type PublicStage = {
  order: number;
  title: string;
  lat: number;
  lng: number;
  route: PublicRoute | null;
  scanned: boolean;
};

export type GameStatus = "not_started" | "traveling" | "solving" | "finished";

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
  /** Chặng hiện tại; null khi đã về đích */
  stage: PublicStage | null;
  /** Câu đố của chặng hiện tại, chỉ có khi đã quét đúng mã */
  puzzle: PublicPuzzle | null;
};

export type ScanResult =
  | { ok: true; state: GameState; puzzle: PublicPuzzle }
  | { ok: false; reason: "wrong_stage" | "invalid" | "not_started"; message: string };

export type AnswerResult =
  | { ok: true; correct: true; successMessage: string; state: GameState }
  | {
      ok: true;
      correct: false;
      message: string;
      puzzle: PublicPuzzle;
      newHint: boolean;
    }
  | { ok: false; reason: "rate_limited" | "not_scanned"; message: string; state?: GameState };
