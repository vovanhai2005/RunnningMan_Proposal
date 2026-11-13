"use client";
import type { Memory } from "@/lib/types";

/** Nền "đêm tím" của lớp câu chuyện: chấm hoa giấy mờ + vài ngôi sao vàng lấp lánh */
export function StoryBackdrop() {
  const stars = [
    { top: "8%", left: "10%", size: 14, delay: "0s" },
    { top: "15%", right: "12%", size: 20, delay: "1.4s" },
    { top: "46%", left: "4%", size: 11, delay: "2.2s" },
    { top: "70%", right: "6%", size: 15, delay: "0.7s" },
    { top: "86%", left: "16%", size: 12, delay: "1.9s" },
  ];
  return (
    <div className="story-sky" aria-hidden="true">
      {stars.map((s, i) => (
        <svg
          key={i}
          className="sparkle"
          style={{ top: s.top, left: s.left, right: s.right, animationDelay: s.delay }}
          width={s.size}
          height={s.size}
          viewBox="0 0 24 24"
        >
          <path fill="var(--butter)" d="M12 1l2.8 8.2L23 12l-8.2 2.8L12 23l-2.8-8.2L1 12l8.2-2.8z" />
        </svg>
      ))}
    </div>
  );
}

/** "4 ảnh và 1 video" */
export function memoryCount(list: Memory[]) {
  const photos = list.filter((m) => m.kind === "photo").length;
  const videos = list.length - photos;
  return [photos && `${photos} ảnh`, videos && `${videos} video`].filter(Boolean).join(" và ");
}

/** Nút mở lại ảnh kỷ niệm của chặng đã qua: quạt 3 ảnh nhỏ + số ảnh */
export function MemoryChip({
  memories,
  onOpen,
  autoFocus = false,
}: {
  memories: Memory[];
  onOpen: () => void;
  autoFocus?: boolean;
}) {
  return (
    <button className="mem-chip" onClick={onOpen} autoFocus={autoFocus}>
      <span className="mem-chip-fan" aria-hidden="true">
        {memories.slice(0, 3).map((m, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m.src} src={m.thumb} alt="" style={{ ["--i" as string]: i }} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <b className="mem-chip-title">Xem ảnh kỷ niệm</b>
        <span className="mem-chip-count">{memoryCount(memories)}</span>
      </span>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9 5l7 7-7 7"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
