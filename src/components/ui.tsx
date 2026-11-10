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

/** Tách chuỗi thành từng chữ hiển thị (giữ nguyên dấu tiếng Việt đi kèm chữ cái) */
function graphemes(text: string): string[] {
  const t = text.normalize("NFC");
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("vi", { granularity: "grapheme" });
    return Array.from(seg.segment(t), (x) => x.segment);
  }
  return Array.from(t);
}

/** Cỡ chữ theo độ dài tên: tên ngắn thật to, tên dài vẫn vừa màn hình điện thoại */
function candySize(name: string) {
  const longest = Math.max(...name.split(/\s+/).map((w) => graphemes(w).length));
  if (longest <= 4) return 92;
  if (longest <= 6) return 76;
  if (longest <= 8) return 62;
  if (longest <= 10) return 52;
  return 42;
}

/**
 * Tên người chơi bằng chữ kẹo 3D: mặt chữ vàng bóng, viền nho dày, khối đùn bên dưới.
 * Từng chữ rơi xuống nảy như thạch khi mở màn; chạm và kéo thì cả tên nghiêng theo ngón tay.
 * Kéo dọc vẫn cuộn trang được (touch-action: pan-y).
 */
export function CandyName({
  name,
  className = "",
  maxSize = Infinity,
}: {
  name: string;
  className?: string;
  /** Giới hạn cỡ chữ khi đặt trong khung nhỏ (vd. bảng chúc mừng) */
  maxSize?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idle, setIdle] = useState(true);
  const words = name.trim().split(/\s+/);
  let i = 0;

  function tilt(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty("--ry", `${(x - 0.5) * 34}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 26}deg`);
  }
  function release() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    setIdle(true);
  }

  return (
    <div className={`candy-stage ${className}`}>
      <div
        ref={ref}
        className={`candy-name ${idle ? "is-idle" : ""}`}
        style={{ fontSize: Math.min(maxSize, candySize(name)) }}
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
        <span className="sr-only">{name}</span>
        {words.map((w, wi) => (
          <span key={wi} className="candy-word" aria-hidden="true">
            {graphemes(w).map((ch, ci) => (
              <span key={ci} className="candy-letter" style={{ ["--i" as string]: i++ }}>
                <span className="candy-letter-back">{ch}</span>
                <span className="candy-letter-face">{ch}</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Băng rôn ruy băng có hai đuôi gấp, như bảng tên màn chơi */
export function Ribbon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`ribbon ${className}`}>
      <RibbonTail className="ribbon-tail ribbon-tail-l" />
      <RibbonTail className="ribbon-tail ribbon-tail-r" />
      <span className="ribbon-band">{children}</span>
    </div>
  );
}

/** Đuôi ruy băng: phần đuôi xẻ chữ V và nếp gấp tối nối vào băng chính */
function RibbonTail({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 50 34" aria-hidden="true">
      <path
        d="M2 4h44v28H2l11-14z"
        fill="#c4296a"
        stroke="var(--grape)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M36 32h10V20z" fill="var(--grape)" />
    </svg>
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

/** Huy chương 3D: các lớp đĩa xếp theo trục Z tạo độ dày, ruy băng hồng–xanh phía sau */
export function Medal() {
  const edges = [-6, -4, -2, 0, 2, 4, 6];
  return (
    <div className="relative">
      {/* Ruy băng */}
      <div aria-hidden="true" className="absolute -top-16 left-1/2 flex -translate-x-1/2 gap-1">
        <span className="block h-24 w-9 origin-bottom -rotate-[14deg] rounded-b-md bg-accent shadow-[inset_-6px_0_0_rgba(0,0,0,0.08)]" />
        <span className="block h-24 w-9 origin-bottom rotate-[14deg] rounded-b-md bg-peri shadow-[inset_6px_0_0_rgba(0,0,0,0.08)]" />
      </div>
      <div className="medal" role="img" aria-label="Huy chương về đích">
        {edges.map((z) => (
          <span key={z} className="medal-layer" style={{ transform: `translateZ(${z}px)` }} />
        ))}
        <span className="medal-face medal-back" />
        <span className="medal-face">
          <svg width="64" height="64" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              stroke="#fff"
              strokeWidth="1.2"
              strokeLinejoin="round"
              d="M12 2.6l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.6l-5.8 3.3 1.5-6.4-4.9-4.3 6.5-.6z"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}
