"use client";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { PublicRest } from "@/lib/types";

/**
 * Nhịp của trạm nghỉ chậm hơn hẳn màn mở đầu chặng: nhãn đáp nhẹ, tách trà ấm hiện lên,
 * khói bốc lững lờ, rồi từng chữ rơi xuống chậm rãi như lá.
 */
const CUP_MS = 450;
const FIRST_WORD_MS = 1250;
const WORD_STEP_MS = 190;
const WORD_MS = 1100;
/** Chạm trong khoảng này (vd. còn đà bấm nút trước) thì bỏ qua */
const GUARD_MS = 900;
const LEAVE_MS = 380;

/**
 * Màn mở đầu trạm nghỉ ("Chặng 2.5"): trời chiều tím hồng, mặt trời lặn dần,
 * tách trà kẹo bốc khói, tiêu đề rơi xuống từng chữ, rồi hiện nút vào trạm nghỉ.
 */
export function RestOpener({ rest, onDone }: { rest: PublicRest; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const openedAt = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const words = rest.heading.trim().split(/\s+/);
  const buttonAt = FIRST_WORD_MS + (words.length - 1) * WORD_STEP_MS + WORD_MS + 200;

  const close = useCallback(() => {
    if (leaving || performance.now() - openedAt.current < GUARD_MS) return;
    setLeaving(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(onDone, reduce ? 0 : LEAVE_MS);
  }, [leaving, onDone]);

  useEffect(() => {
    openedAt.current = performance.now();
    const t = setTimeout(() => buttonRef.current?.focus({ preventScroll: true }), buttonAt);
    return () => clearTimeout(t);
  }, [buttonAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${rest.label}: ${rest.heading}`}
      className={`story-layer chapter rest-layer ${leaving ? "is-leaving" : ""}`}
      onClick={close}
    >
      <div className="story-sky rest-sky" aria-hidden="true">
        <span className="rest-sun" />
      </div>
      <div className="chapter-body">
        <span className="sticker chapter-tag rest-tag">{rest.label}</span>
        <TeaCup steaming className="rest-cup" style={{ animationDelay: `${CUP_MS}ms` }} />
        <h1 className="chapter-title rest-title">
          <span className="sr-only">{rest.heading}</span>
          {words.map((w, i) => (
            <Fragment key={i}>
              {i > 0 && " "}
              <span
                className="chapter-word rest-word"
                aria-hidden="true"
                style={{
                  animationDelay: `${FIRST_WORD_MS + i * WORD_STEP_MS}ms`,
                  ["--tilt" as string]: i % 2 ? 1 : -1,
                }}
              >
                <span className="chapter-word-back">{w}</span>
                <span className="chapter-word-face">{w}</span>
              </span>
            </Fragment>
          ))}
        </h1>
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
          Vào trạm nghỉ
        </button>
      </div>
    </div>
  );
}

/** Tách trà kẹo: viền nho, men kem, sọc hồng, nước trà màu caramel; `steaming` thì khói bốc lên */
export function TeaCup({
  steaming = false,
  className,
  style,
}: {
  steaming?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const clip = `cup-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const body = "M30 62 H130 C130 98 112 122 80 122 C48 122 30 98 30 62 Z";
  return (
    <svg
      className={`teacup ${className ?? ""}`}
      style={style}
      viewBox="0 0 160 150"
      width="160"
      height="150"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <path d={body} />
        </clipPath>
      </defs>
      {steaming && (
        <g className="teacup-steam" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round">
          <path pathLength={60} style={{ ["--i" as string]: 0 }} d="M62 48 c-11 -11 9 -19 -1 -32" />
          <path pathLength={60} style={{ ["--i" as string]: 1 }} d="M80 44 c-12 -13 11 -21 0 -36" />
          <path pathLength={60} style={{ ["--i" as string]: 2 }} d="M98 48 c-11 -11 9 -19 -1 -32" />
        </g>
      )}
      {/* Đĩa lót */}
      <ellipse
        cx="80"
        cy="126"
        rx="62"
        ry="12"
        fill="#ffd3e4"
        stroke="var(--grape)"
        strokeWidth="5"
      />
      {/* Quai */}
      <path
        d="M126 74 c22 -4 26 26 0 32"
        fill="none"
        stroke="var(--grape)"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M126 74 c22 -4 26 26 0 32"
        fill="none"
        stroke="#fffaf0"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Thân tách + sọc hồng */}
      <path d={body} fill="#fffaf0" />
      <g clipPath={`url(#${clip})`}>
        <rect x="20" y="82" width="120" height="14" fill="var(--accent)" />
        <rect x="20" y="96" width="120" height="4" fill="var(--accent-press)" opacity="0.45" />
        <path
          d="M44 72 C44 92 52 106 64 113"
          fill="none"
          stroke="#fff"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.9"
        />
      </g>
      <path d={body} fill="none" stroke="var(--grape)" strokeWidth="5" strokeLinejoin="round" />
      {/* Miệng tách: nước trà */}
      <ellipse
        cx="80"
        cy="62"
        rx="50"
        ry="10"
        fill="#e9a15c"
        stroke="var(--grape)"
        strokeWidth="5"
      />
      <ellipse cx="68" cy="60" rx="16" ry="3" fill="#ffd9a8" opacity="0.8" />
    </svg>
  );
}
