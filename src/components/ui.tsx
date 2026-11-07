"use client";
import type { ReactNode } from "react";

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
  tone?: "light" | "dark";
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/45 fade-in">
      <div
        className={`sheet-enter relative max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-y-auto overscroll-contain rounded-t-[28px] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-2xl ${
          tone === "dark" ? "bg-night text-white" : "bg-paper text-ink"
        }`}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-current opacity-15" />
        {onClose && (
          <button
            onClick={onClose}
            className={`absolute right-3 top-3 min-h-11 rounded-full px-4 text-[15px] font-semibold ${
              tone === "dark" ? "bg-white/10" : "bg-[#F1F2F5]"
            }`}
          >
            {closeLabel}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-[13px] font-extrabold uppercase tracking-[0.14em] text-accent ${className}`}>
      {children}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-current border-r-transparent ${className}`}
      aria-hidden="true"
    />
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
    <main className="app-screen race-stripes flex flex-col items-center justify-center px-8 text-center text-white">
      <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-white/10 text-4xl">
        {icon}
      </div>
      <h1 className="text-[26px] font-extrabold leading-tight">{title}</h1>
      {body && <div className="mt-3 max-w-[340px] text-white/75">{body}</div>}
      {action && <div className="mt-8 w-full max-w-[340px]">{action}</div>}
    </main>
  );
}
