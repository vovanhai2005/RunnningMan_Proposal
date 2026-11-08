"use client";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";

/** Thẻ trượt lên từ đáy, phủ lên bản đồ */
export function Sheet({
  children,
  onClose,
  closeLabel = "Đóng",
  tone = "light",
}: {
  children: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  /** "glow": nền trời có mây hồng–vàng cho khoảnh khắc chúc mừng */
  tone?: "light" | "glow";
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-[#2B2160]/40 backdrop-blur-[2px] fade-in">
      <div
        className={`sheet-enter relative max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-y-auto overscroll-contain rounded-t-[32px] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] text-ink shadow-[0_-14px_40px_-12px_rgba(43,33,96,0.4)] ${
          tone === "glow" ? "sky" : "bg-paper"
        }`}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-peri/30" />
        {onClose && (
          <button onClick={onClose} className="btn btn-ghost btn-sm absolute right-3 top-3 z-10">
            {closeLabel}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** Nhãn dán vàng ghi số nhiệm vụ */
export function StageTag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`sticker ${className}`}>{children}</span>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-current border-r-transparent ${className}`}
      aria-hidden="true"
    />
  );
}

/** Vài ngôi sao lấp lánh trôi nhẹ trên nền (trang trí, không bắt sự kiện) */
export function Sparkles() {
  const stars = [
    { top: "9%", left: "8%", size: 14, delay: "0s", color: "var(--accent-soft)" },
    { top: "14%", right: "10%", size: 22, delay: "1.2s", color: "var(--butter)" },
    { top: "40%", left: "90%", size: 11, delay: "2.1s", color: "var(--peri)" },
    { top: "66%", left: "3%", size: 13, delay: "0.6s", color: "var(--butter)" },
    { top: "84%", right: "8%", size: 16, delay: "1.8s", color: "var(--accent-soft)" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map((s, i) => (
        <svg
          key={i}
          className="sparkle"
          style={{ top: s.top, left: s.left, right: s.right, animationDelay: s.delay, color: s.color }}
          width={s.size}
          height={s.size}
          viewBox="0 0 24 24"
        >
          <path fill="currentColor" d="M12 1l2.8 8.2L23 12l-8.2 2.8L12 23l-2.8-8.2L1 12l8.2-2.8z" />
        </svg>
      ))}
    </div>
  );
}

/**
 * Bảng tên người chơi 3D: tự bồng bềnh, chạm và kéo thì nghiêng theo ngón tay.
 * Kéo dọc vẫn cuộn trang được (touch-action: pan-y).
 */
export function NameTag3D({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idle, setIdle] = useState(true);

  function tilt(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty("--ry", `${(x - 0.5) * 30}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 24}deg`);
    el.style.setProperty("--gx", `${x * 100}%`);
  }
  function release() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    setIdle(true);
  }

  return (
    <div className="tag-stage">
      <div
        ref={ref}
        className={`tag3d px-7 py-8 ${idle ? "is-idle" : ""}`}
        onPointerDown={(e) => {
          setIdle(false);
          tilt(e);
        }}
        onPointerMove={(e) => {
          if (idle) setIdle(false);
          tilt(e);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        <span className="tag3d-stitch" />
        <span className="tag3d-sheen" />
        <div className="tag3d-name display-title relative break-words text-center text-[44px] [text-shadow:0_2px_0_rgba(255,255,255,0.6)]">
          {name}
        </div>
      </div>
    </div>
  );
}

/** Màn trạng thái toàn màn hình: tải, mất sóng, tài khoản chưa ghi danh… (không hiện mã lỗi) */
export function StatusScreen({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <main className="app-screen sky flex flex-col items-center justify-center px-8 text-center">
      <Sparkles />
      <div className="puff relative mb-7 grid h-20 w-20 place-items-center rounded-[28px] text-4xl">
        {icon}
      </div>
      <h1 className="display-title relative text-[30px]">{title}</h1>
      {body && <div className="relative mt-3 max-w-[340px] text-muted">{body}</div>}
      {action && <div className="relative mt-8 w-full max-w-[340px]">{action}</div>}
    </main>
  );
}
