"use client";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import type { PublicQuiz } from "@/lib/types";
import { Spinner } from "./ui";

/** Rung ô trả lời khi sai (bỏ qua nếu người dùng tắt chuyển động) */
export function shake(el: HTMLElement | null) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(
    [0, -7, 7, -5, 5, -2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 420, easing: "ease-out" },
  );
}

/** Đã tới giờ mà server chưa gửi gợi ý (lệch đồng hồ): hỏi lại cách nhau chừng này */
const ASK_AGAIN_MS = 5000;

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Câu hỏi sau khi quét mã: thẻ câu hỏi có cuống vé để điền đáp án, nút trả lời,
 * và nút gợi ý bị khóa (đếm ngược) cho tới khi server cho phép.
 */
export function QuizStep({
  quiz,
  serverNow,
  onAnswer,
  onHintDue,
}: {
  quiz: PublicQuiz;
  /** Giờ server lúc lấy trạng thái, để đếm ngược theo đồng hồ server */
  serverNow: string;
  /** Gửi câu trả lời; trả về lời báo sai, hoặc null khi đúng */
  onAnswer: (answer: string) => Promise<string | null>;
  /** Đã tới giờ mở gợi ý: lấy lại trạng thái để nhận chữ gợi ý */
  onHintDue: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const slotRef = useRef<HTMLLabelElement>(null);

  // Đếm ngược theo đồng hồ server (máy điện thoại có thể chạy lệch giờ)
  const [offset] = useState(() => Date.parse(serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (quiz.hint) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [quiz.hint]);
  const left = Math.max(0, Date.parse(quiz.hintAt) - (now + offset));

  const lastAsk = useRef(0);
  useEffect(() => {
    if (quiz.hint || left > 0 || now - lastAsk.current < ASK_AGAIN_MS) return;
    lastAsk.current = now;
    onHintDue();
  }, [quiz.hint, left, now, onHintDue]);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const err = await onAnswer(text);
    setBusy(false);
    if (err) {
      setError(err);
      shake(slotRef.current);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col items-center text-center" noValidate>
      <figure className="lvl-clue w-full text-left">
        <figcaption className="lvl-clue-label">Câu hỏi cuối</figcaption>
        <p className="whitespace-pre-line text-[19px] font-semibold leading-relaxed text-ink">
          {quiz.question}
        </p>
        <label ref={slotRef} className={`lvl-answer ${error ? "is-wrong" : ""}`}>
          <input
            className="lvl-answer-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            aria-label="Câu trả lời"
            maxLength={120}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-invalid={!!error}
            aria-describedby="quiz-msg"
          />
        </label>
      </figure>

      <p
        id="quiz-msg"
        role={error ? "alert" : undefined}
        className={`lvl-status mt-4 ${error ? "is-wrong" : ""}`}
      >
        {error ?? "Trả lời đúng là về đích!"}
      </p>
      <button className="btn btn-primary mt-5 w-full" disabled={busy || !text.trim()}>
        {busy ? <Spinner /> : "Trả lời"}
      </button>

      {showHint && quiz.hint ? (
        <figure className="lvl-clue lvl-secret mt-7 w-full text-left fade-in" role="status">
          <figcaption className="lvl-clue-label">Gợi ý</figcaption>
          <p className="whitespace-pre-line text-[17px] leading-relaxed text-ink">{quiz.hint}</p>
        </figure>
      ) : (
        <button
          type="button"
          className="lvl-hint-btn mt-3"
          disabled={!quiz.hint}
          onClick={() => setShowHint(true)}
        >
          <BulbIcon />
          {quiz.hint ? (
            "Xem gợi ý"
          ) : left > 0 ? (
            <>
              Gợi ý mở sau <span className="lvl-hint-clock">{clock(left)}</span>
            </>
          ) : (
            "Đang mở gợi ý…"
          )}
        </button>
      )}
    </form>
  );
}

function BulbIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
