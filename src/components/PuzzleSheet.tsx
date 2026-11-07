"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PublicPuzzle } from "@/lib/types";
import { Kicker, Sheet, Spinner } from "./ui";

export type AnswerOutcome = { error?: string; newHint?: boolean } | null;

export function PuzzleSheet({
  puzzle,
  totalStages,
  onAnswer,
  onClose,
}: {
  puzzle: PublicPuzzle;
  totalStages: number;
  onAnswer?: (answer: string) => Promise<AnswerOutcome>;
  onClose: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hintFlash, setHintFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hintFlash) return;
    hintsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHintFlash(false), 2500);
    return () => clearTimeout(t);
  }, [hintFlash]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!onAnswer || busy || !answer.trim()) return;
    setBusy(true);
    setFeedback(null);
    const r = await onAnswer(answer);
    setBusy(false);
    if (r?.error) {
      setFeedback(r.error);
      // Lắc nhẹ ô nhập (không gắn lại input để bàn phím không bị đóng)
      const el = inputRef.current;
      if (el) {
        el.classList.remove("is-wrong");
        void el.offsetWidth;
        el.classList.add("is-wrong");
        el.select();
      }
      if (r.newHint) setHintFlash(true);
    }
  }

  return (
    <Sheet onClose={onClose} closeLabel={puzzle.readOnly ? "Đóng" : "Xem bản đồ"}>
      <Kicker className="mt-2">
        Nhiệm vụ {puzzle.order}/{totalStages}
        {puzzle.readOnly ? " · Đã hoàn thành" : " · Câu đố"}
      </Kicker>
      <h2 className="mt-1 pr-28 text-[24px] font-extrabold leading-tight">{puzzle.title}</h2>

      <div className="mt-4 whitespace-pre-line rounded-2xl bg-[#F6F7F9] p-4 text-[18px] leading-relaxed">
        {puzzle.text}
      </div>
      {puzzle.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={puzzle.imageUrl}
          alt="Hình ảnh câu đố"
          className="mt-3 w-full rounded-2xl border border-line object-contain"
        />
      )}

      {puzzle.hints.length > 0 && (
        <div
          ref={hintsRef}
          className={`mt-4 rounded-2xl border-2 p-4 transition-colors ${
            hintFlash ? "border-yellow bg-[#FFF3C9]" : "border-[#FFE7A0] bg-[#FFF9E6]"
          }`}
        >
          <div className="mb-1 text-[13px] font-extrabold uppercase tracking-[0.12em] text-[#9A6B00]">
            💡 Gợi ý từ Ban tổ chức
          </div>
          <ul className="flex flex-col gap-1.5">
            {puzzle.hints.map((h, i) => (
              <li key={i} className="text-[17px]">
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {puzzle.readOnly ? (
        puzzle.successMessage && (
          <div className="mt-4 rounded-2xl bg-[#E7F6EE] p-4 font-semibold text-[#0B6B35]">
            ✓ {puzzle.successMessage}
          </div>
        )
      ) : (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <label htmlFor="answer" className="text-[15px] font-semibold text-muted">
            Đáp án của bạn
          </label>
          <input
            id="answer"
            ref={inputRef}
            className="field"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              if (feedback) {
                setFeedback(null);
                e.target.classList.remove("is-wrong");
              }
            }}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder="Nhập đáp án…"
          />
          {feedback && (
            <p role="alert" className="font-semibold text-bad fade-in">
              {feedback}
            </p>
          )}
          <button className="btn btn-primary mt-1 w-full" disabled={busy || !answer.trim()}>
            {busy ? <Spinner /> : "Trả lời"}
          </button>
        </form>
      )}
    </Sheet>
  );
}
