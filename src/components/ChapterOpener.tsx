"use client";
import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import type { Chapter } from "@/lib/types";
import { StoryBackdrop } from "./story";

/** Mỗi chữ của tên chặng trồi lên cách nhau chừng này */
const WORD_STEP_MS = 110;
const FIRST_WORD_MS = 420;
/** Chạm trong khoảng này (vd. còn đà bấm nút trước) thì bỏ qua, để không lỡ tay tắt màn mở đầu */
const GUARD_MS = 700;
const LEAVE_MS = 380;

/** Cỡ chữ theo độ dài câu: tên ngắn thật to, câu dài vẫn gọn trong 3–4 dòng */
function titleSize(title: string) {
  const n = title.length;
  if (n <= 22) return "min(48px, 12vw)";
  if (n <= 32) return "min(42px, 10.5vw)";
  return "min(36px, 9vw)";
}

/**
 * Màn mở đầu chặng: nhãn "Chặng N" rơi xuống, tên chặng trồi lên từng chữ,
 * vệt chấm hồng (như con đường trên bản đồ) chạy tới trái tim, rồi hiện nút vào chặng.
 */
export function ChapterOpener({
  order,
  chapter,
  onDone,
}: {
  order: number;
  chapter: Chapter;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const openedAt = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const words = chapter.title.trim().split(/\s+/);
  const trailAt = FIRST_WORD_MS + words.length * WORD_STEP_MS + 120;
  const buttonAt = trailAt + 650;

  const close = useCallback(() => {
    if (leaving || performance.now() - openedAt.current < GUARD_MS) return;
    setLeaving(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(onDone, reduce ? 0 : LEAVE_MS);
  }, [leaving, onDone]);

  useEffect(() => {
    openedAt.current = performance.now();
    // Đưa tiêu điểm vào nút khi nút đã hiện (bàn phím / VoiceOver)
    const t = setTimeout(() => buttonRef.current?.focus({ preventScroll: true }), buttonAt);
    return () => clearTimeout(t);
  }, [buttonAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const label = chapter.numbered ? `Chặng ${order}: ${chapter.title}` : chapter.title;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={`story-layer chapter ${leaving ? "is-leaving" : ""}`}
      onClick={close}
    >
      <StoryBackdrop />
      <div className="chapter-body">
        {chapter.numbered && <span className="sticker chapter-tag">Chặng {order}</span>}
        <h1 className="chapter-title" style={{ fontSize: titleSize(chapter.title) }}>
          <span className="sr-only">{chapter.title}</span>
          {words.map((w, i) => (
            <Fragment key={i}>
              {/* Khoảng trắng thật giữa các chữ: xuống dòng và cân dòng (balance) đúng */}
              {i > 0 && " "}
              <span
                className="chapter-word"
                aria-hidden="true"
                style={{ animationDelay: `${FIRST_WORD_MS + i * WORD_STEP_MS}ms` }}
              >
                <span className="chapter-word-back">{w}</span>
                <span className="chapter-word-face">{w}</span>
              </span>
            </Fragment>
          ))}
        </h1>
        <HeartTrail delay={trailAt} />
      </div>
      <div className="chapter-foot" style={{ animationDelay: `${buttonAt}ms` }}>
        <button
          ref={buttonRef}
          className="btn btn-primary w-full"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
        >
          {chapter.numbered ? `Vào chặng ${order}` : "Lên đường"}
        </button>
      </div>
    </div>
  );
}

/** Vệt chấm hồng uốn lượn như con đường kẹo trên bản đồ, kết thúc ở một trái tim */
function HeartTrail({ delay }: { delay: number }) {
  const mask = `trail-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      className="chapter-trail"
      viewBox="0 0 240 64"
      width="240"
      height="64"
      aria-hidden="true"
      style={{ ["--d" as string]: `${delay}ms` }}
    >
      <defs>
        {/* Dải che kéo dần sang phải: vệt chấm hiện ra như đang được vẽ */}
        <mask id={mask}>
          <rect className="chapter-trail-wipe" x="0" y="0" width="200" height="64" fill="#fff" />
        </mask>
      </defs>
      <path
        mask={`url(#${mask})`}
        d="M8 40 C 50 10, 92 62, 138 34 S 186 18, 196 32"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="0 15"
      />
      <path
        className="chapter-trail-heart"
        d="M214 52s-15-9.4-15-19.6a8 8 0 0 1 15-4 8 8 0 0 1 15 4C229 42.6 214 52 214 52z"
        fill="var(--accent)"
        stroke="var(--grape-deep)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        className="chapter-trail-heart"
        d="M205 31.5a4 4 0 0 1 4-4"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
    </svg>
  );
}
