"use client";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { CompletedStage, Memory } from "@/lib/types";
import { StoryBackdrop } from "./story";

/** Độ nghiêng riêng của từng ảnh khi nằm trên cùng, để chồng ảnh trông như xếp bằng tay */
const TILTS = [-2.2, 1.8, -1.2, 2.4, -2.8, 1.2];
/** Ảnh nằm dưới: lệch xuống, nhỏ lại, xòe ra hai bên */
const UNDER = [
  { y: 14, s: 0.955, r: 5 },
  { y: 26, s: 0.91, r: -5.5 },
];
const SWIPE_PX = 70;
const TAP_PX = 8;
const CYCLE_MS = 620;
const DEAL_MS = 1150;

type Cycle = { dir: 1 | -1; dx: number; r0: number; key: number };

/**
 * Chồng ảnh kỷ niệm của một chặng, chia bài từ dưới lên khi mở.
 * Chạm hoặc vuốt ảnh trên cùng: ảnh văng sang bên rồi nhét xuống đáy chồng.
 * `unlock`: vừa quét được mã (nút "Tiếp tục" sang bảng chúc mừng); ngược lại là xem lại.
 */
export function MemoryReel({
  stage,
  unlock,
  onDone,
}: {
  stage: CompletedStage;
  unlock: boolean;
  onDone: () => void;
}) {
  const items = stage.memories;
  const n = items.length;
  const [index, setIndex] = useState(0);
  const [cycling, setCycling] = useState<Record<number, Cycle>>({});
  const [returning, setReturning] = useState<{ i: number; key: number } | null>(null);
  const [dealing, setDealing] = useState(true);
  const [dragDx, setDragDx] = useState<number | null>(null);
  const press = useRef<{ x: number; id: number } | null>(null);
  const tick = useRef(0);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDealing(false), DEAL_MS);
    return () => clearTimeout(t);
  }, []);

  const next = useCallback(
    (dir: 1 | -1, dx = 0) => {
      if (n < 2) return;
      const key = ++tick.current;
      const i = index;
      setCycling((c) => ({ ...c, [i]: { dir, dx, r0: TILTS[i % TILTS.length] + dx / 16, key } }));
      setTimeout(
        () =>
          setCycling((c) => {
            if (c[i]?.key !== key) return c;
            const rest = { ...c };
            delete rest[i];
            return rest;
          }),
        CYCLE_MS,
      );
      setReturning(null);
      setIndex((index + 1) % n);
    },
    [index, n],
  );

  const prev = useCallback(() => {
    if (n < 2) return;
    const p = (index - 1 + n) % n;
    setCycling((c) => {
      const rest = { ...c };
      delete rest[p];
      return rest;
    });
    setReturning({ i: p, key: ++tick.current });
    setIndex(p);
  }, [index, n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next(-1);
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape" && !unlock) onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onDone, unlock]);

  useEffect(() => {
    doneRef.current?.focus({ preventScroll: true });
  }, []);

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (dealing || n < 2) return;
    press.current = { x: e.clientX, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    if (dragDx !== null || Math.abs(dx) > TAP_PX) setDragDx(dx);
  }
  function onUp(e: PointerEvent<HTMLDivElement>) {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    const dx = e.clientX - p.x;
    setDragDx(null);
    if (Math.abs(dx) >= SWIPE_PX) next(dx > 0 ? 1 : -1, dx);
    else if (Math.abs(dx) <= TAP_PX) next(-1);
  }
  function onCancel() {
    press.current = null;
    setDragDx(null);
  }

  const title = stage.chapter?.title ?? stage.place.title;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ảnh kỷ niệm: ${title}`}
      className="story-layer reel"
    >
      <StoryBackdrop />

      <header className="reel-head">
        {(stage.chapter?.numbered ?? true) && (
          <span className="sticker">Chặng {stage.order}</span>
        )}
        <h2 className="reel-title">{title}</h2>
      </header>

      <div className="reel-stack">
        {items.map((m, i) => {
          const offset = (i - index + n) % n;
          const top = offset === 0;
          const cyc = cycling[i];
          const tilt = TILTS[i % TILTS.length];
          let transform: string;
          let hidden = false;
          if (top) {
            const dx = dragDx ?? 0;
            transform = `translateX(${dx}px) rotate(${tilt + dx / 16}deg)`;
          } else {
            const u = UNDER[Math.min(offset, UNDER.length) - 1];
            hidden = offset > UNDER.length;
            transform = `translateY(${u.y}px) scale(${u.s}) rotate(${u.r}deg)`;
          }
          const classes = [
            "mem-card",
            hidden && "is-hidden",
            top && dragDx !== null && "is-dragging",
            dealing && offset <= UNDER.length && "is-dealing",
            cyc && "is-cycling",
            returning?.i === i && "is-returning",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={returning?.i === i ? `${i}-${returning.key}` : cyc ? `${i}-c${cyc.key}` : i}
              className={classes}
              aria-hidden={!top}
              style={{
                ["--ar" as string]: m.width / m.height,
                ["--dir" as string]: cyc?.dir ?? -1,
                ["--dx" as string]: `${cyc?.dx ?? 0}px`,
                ["--r0" as string]: `${cyc?.r0 ?? tilt}deg`,
                transform,
                zIndex: top ? n + 1 : n - offset,
                animationDelay: dealing ? `${150 + (UNDER.length - offset) * 140}ms` : undefined,
              }}
              onPointerDown={top ? onDown : undefined}
              onPointerMove={top ? onMove : undefined}
              onPointerUp={top ? onUp : undefined}
              onPointerCancel={top ? onCancel : undefined}
            >
              <MemoryFace m={m} active={top && !dealing} alt={`Ảnh ${i + 1} của chặng ${stage.order}`} />
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <nav className="reel-nav" aria-label="Chuyển ảnh">
          <button className="reel-arrow" onClick={prev} aria-label="Ảnh trước">
            <Chevron dir="left" />
          </button>
          <span className="reel-dots" aria-hidden="true">
            {items.map((_, i) => (
              <i key={i} className={i === index ? "is-on" : ""} />
            ))}
          </span>
          <button className="reel-arrow" onClick={() => next(-1)} aria-label="Ảnh tiếp theo">
            <Chevron dir="right" />
          </button>
        </nav>
      )}
      <p className="sr-only" aria-live="polite">
        Ảnh {index + 1} trên {n}
      </p>

      <div className="reel-foot">
        <button
          ref={doneRef}
          className={`btn w-full ${unlock ? "btn-primary" : "btn-ghost reel-close"}`}
          onClick={onDone}
        >
          {unlock ? "Tiếp tục" : "Đóng"}
        </button>
      </div>
    </div>
  );
}

function MemoryFace({ m, active, alt }: { m: Memory; active: boolean; alt: string }) {
  if (m.kind === "video") return <VideoFace m={m} active={active} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="mem-media" src={m.src} alt={alt} draggable={false} decoding="async" />
  );
}

/** Video chỉ chạy khi nằm trên cùng; tắt tiếng sẵn để Safari cho tự phát, chạm loa để bật tiếng */
function VideoFace({ m, active }: { m: Memory; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) void v.play().catch(() => {});
    else v.pause();
  }, [active]);

  return (
    <>
      <video
        ref={ref}
        className="mem-media"
        src={m.src}
        poster={m.poster ?? undefined}
        muted={muted}
        playsInline
        loop
        preload={active ? "auto" : "metadata"}
      />
      {active && (
        <button
          className="mem-sound"
          aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
          aria-pressed={!muted}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const v = ref.current;
            // Đổi ngay trong cú chạm: iOS chỉ cho bật tiếng khi đang trong thao tác của người dùng
            if (v) {
              v.muted = !muted;
              if (v.paused) void v.play().catch(() => {});
            }
            setMuted(!muted);
          }}
        >
          <SpeakerIcon muted={muted} />
        </button>
      )}
    </>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" strokeLinejoin="round" />
      {muted ? (
        <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      ) : (
        <path
          d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
