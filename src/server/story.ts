import type { Chapter, Memory, PublicQuiz, PublicRest } from "@/lib/types";
import generated from "./memories.generated.json";

/**
 * Tên từng chặng (màn mở đầu chặng). Đặt ở server để trình duyệt chỉ biết tên của chặng đã mở.
 * `numbered: false`: chỉ hiện câu, không ghi "Chặng N".
 */
const CHAPTERS: Record<number, Chapter> = {
  1: { title: "Nơi tình yêu bắt đầu", numbered: true },
  2: { title: "Đường đến con tym nhanh nhất là qua dạ dày", numbered: true },
  3: { title: "We only live once, but love forever", numbered: true },
  4: { title: "Chặng đường tiếp theo bắt đầu từ căn villa", numbered: false },
};

/**
 * Trạm nghỉ, theo số của chặng đứng ngay SAU trạm (3 = trạm nghỉ giữa chặng 2 và chặng 3,
 * tức "Chặng 2.5"). Không có mã QR: người chơi bấm "Nghỉ xong, lên đường" là mở chặng sau.
 * `lat`/`lng` để null thì nút chỉ đường tìm theo `address`.
 */
type RestStop = Omit<PublicRest, "label" | "done" | "place"> & {
  title: string;
  address: string;
  lat: number | null;
  lng: number | null;
};
const REST_STOPS: Record<number, RestStop> = {
  3: {
    heading: "Nghỉ chân một chút",
    note: "Anna ơi, hãy nghỉ chân một chút trước khi đến với cuộc hành trình dài nhé.",
    title: "24 Phố Trạm",
    address: "24 Phố Trạm, Long Biên, Hà Nội",
    lat: null,
    lng: null,
  },
};

/** Danh sách do `npm run memories:build` tạo từ `src/assets/stage/stage<N>/` */
const MEMORIES = generated as Record<string, Memory[]>;

export const chapterOf = (order: number): Chapter | null => CHAPTERS[order] ?? null;

export const memoriesOf = (order: number): Memory[] => MEMORIES[String(order)] ?? [];

export const hasRestBefore = (order: number) => order in REST_STOPS;

export function restBefore(order: number, done: boolean): PublicRest | null {
  const r = REST_STOPS[order];
  if (!r) return null;
  return {
    label: `Chặng ${order - 1}.5`,
    heading: r.heading,
    note: r.note,
    place: { title: r.title, address: r.address, lat: r.lat, lng: r.lng },
    done,
  };
}

/**
 * Câu hỏi hiện ra sau khi quét mã của chặng (theo số chặng). Trả lời đúng một trong `answers`
 * (không phân biệt hoa thường, dấu, dấu câu; câu trả lời chứa trọn đáp án cũng tính) mới qua chặng.
 * Gợi ý mở sau `hintAfterMs` kể từ lúc quét mã.
 */
type QuizConfig = { question: string; answers: string[]; hint: string; hintAfterMs: number };
const QUIZZES: Record<number, QuizConfig> = {
  4: {
    question: "Món quà đầu tiên An Na Nguyen tặng cho VĐH là con gì?",
    // "con Deadpool", "Dead-pool", "deadpool!" đều đúng (bỏ hoa thường, dấu câu; chứa trọn đáp án)
    answers: ["deadpool", "dead pool"],
    hint: "Hãy ghép các mảnh ghép trong các phong bì lại với nhau.",
    hintAfterMs: 5 * 60_000,
  },
};

/** Cấu hình câu hỏi (chỉ dùng ở server, có đáp án) */
export const quizConfigOf = (order: number): QuizConfig | null => QUIZZES[order] ?? null;

/** Phần câu hỏi được gửi xuống trình duyệt: không có đáp án, gợi ý chỉ có khi đã tới giờ */
export function publicQuiz(cfg: QuizConfig, startedAt: string, now: Date): PublicQuiz {
  const hintAt = new Date(new Date(startedAt).getTime() + cfg.hintAfterMs);
  return {
    question: cfg.question,
    hintAt: hintAt.toISOString(),
    hint: now >= hintAt ? cfg.hint : null,
  };
}
