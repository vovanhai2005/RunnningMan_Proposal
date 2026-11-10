"use client";
import { Sheet, Sparkles, StageTag } from "./ui";

export function SuccessSheet({
  order,
  message,
  isLast,
  onContinue,
}: {
  order: number;
  message: string;
  isLast: boolean;
  onContinue: () => void;
}) {
  return (
    <Sheet tone="glow">
      <Sparkles />
      <div className="relative flex flex-col items-center px-2 pt-4 text-center">
        {/* Dấu mộc lật 3D */}
        <div className="stamp-flip">
          <div className="grid h-28 w-28 place-items-center rounded-full border-4 border-white bg-gradient-to-b from-[#FF7CB0] to-accent text-white shadow-[0_7px_0_var(--accent-press),0_22px_30px_-12px_rgba(194,46,108,0.6)]">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <StageTag className="mt-7">Nhiệm vụ {order} hoàn thành</StageTag>
        <h2 className="display-title display-hero mt-3 text-[44px]">Tìm thấy rồi!</h2>
        <p className="mt-4 max-w-[34ch] whitespace-pre-line text-[18px] leading-relaxed text-ink/85">
          {message}
        </p>
        <p className="mt-3 text-[14px] font-medium text-muted">Ban tổ chức</p>
        <button className="btn btn-primary mt-8 w-full" onClick={onContinue}>
          {isLast ? "Về đích" : "Mở màn tiếp theo"}
        </button>
      </div>
    </Sheet>
  );
}
