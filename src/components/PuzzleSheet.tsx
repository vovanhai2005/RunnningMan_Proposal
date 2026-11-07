"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PublicPuzzle } from "@/lib/types";
import { Sheet, Spinner, StageTag } from "./ui";

export type AnswerOutcome = { error?: string; newHint?: boolean } | null;

export function PuzzleSheet({
  puzzle,
  onAnswer,
  onClose,
}: {
  puzzle: PublicPuzzle;
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
      <div className="mt-2 flex items-center gap-2 pr-32">
        <StageTag>Nhiệm vụ {puzzle.order}</StageTag>
        {puzzle.readOnly && <span className="text-[14px] font-semibold text-ok">Đã hoàn thành</span>}
      </div>
      <h2 className="display-title mt-3 text-[27px]">{puzzle.title}</h2>

      <div className="mt-4 whitespace-pre-line rounded-3xl border-2 border-dashed border-butter-deep/40 bg-cream p-5 text-[18px] leading-relaxed">
        {puzzle.text}
      </div>
      {puzzle.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={puzzle.imageUrl}
          alt="Hình ảnh câu đố"
          className="mt-3 w-full rounded-3xl border-2 border-line object-contain"
        />
      )}

      {puzzle.hints.length > 0 && (
        <div
          ref={hintsRef}
          className={`mt-4 rounded-3xl border-[1.5px] p-4 transition-colors ${
            hintFlash ? "border-peri bg-[#DDE2FF]" : "border-[#D3D8FB] bg-[#F1F3FF]"
          }`}
        >
          <div className="mb-1 text-[15px] font-bold text-peri-deep">
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
          <div className="mt-4 rounded-3xl bg-[#E2F6EE] p-4 font-medium text-[#17694F]">
            ✓ {puzzle.successMessage}
          </div>
        )
      ) : (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <label htmlFor="answer" className="pl-1 text-[15px] font-semibold text-muted">
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
            <p role="alert" className="pl-1 font-medium text-bad fade-in">
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
