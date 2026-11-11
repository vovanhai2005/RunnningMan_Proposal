"use client";
import type { PublicPlace } from "@/lib/types";
import { PlaceCard } from "./PlaceCard";
import { Sheet, Sparkles, StageTag } from "./ui";

export function SuccessSheet({
  order,
  message,
  next,
  onContinue,
}: {
  order: number;
  message: string;
  /** Điểm đến tiếp theo vừa được mở; null khi vừa xong chặng cuối */
  next: PublicPlace | null;
  onContinue: () => void;
}) {
  return (
    <Sheet tone="glow">
      <Sparkles />
      <div className="relative flex flex-col items-center px-2 pt-2 text-center">
        {/* Dấu mộc lật 3D */}
        <div className="stamp-flip">
          <div className="grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-gradient-to-b from-[#FF7CB0] to-accent text-white shadow-[0_7px_0_var(--accent-press),0_22px_30px_-12px_rgba(194,46,108,0.6)]">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
        <StageTag className="mt-6">Nhiệm vụ {order} hoàn thành</StageTag>
        <h2 className="display-title display-hero mt-3 text-[42px]">Tìm thấy rồi!</h2>
        {message && (
          <>
            <p className="mt-3 max-w-[34ch] whitespace-pre-line text-[17px] leading-relaxed text-ink/85">
              {message}
            </p>
            <p className="mt-2 text-[14px] font-medium text-muted">Ban tổ chức</p>
          </>
        )}
        {next && (
          <div className="mt-6 w-full">
            <PlaceCard place={next} label="Điểm đến tiếp theo" />
          </div>
        )}
        <button className="btn btn-primary mt-6 w-full" onClick={onContinue}>
          {next ? "Mở màn tiếp theo" : "Về đích"}
        </button>
      </div>
    </Sheet>
  );
}
