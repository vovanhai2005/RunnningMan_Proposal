"use client";
import type { PublicPlace } from "@/lib/types";
import { PlaceCard } from "./PlaceCard";
import { Sheet, Sparkles, StageTag } from "./ui";

/** Vừa đoán đúng địa điểm: lộ điểm đến, dặn di chuyển tới đó để nhận nhiệm vụ */
export function SolvedSheet({
  order,
  place,
  onClose,
}: {
  order: number;
  place: PublicPlace;
  onClose: () => void;
}) {
  return (
    <Sheet tone="glow">
      <Sparkles />
      <div className="relative flex flex-col items-center px-2 pt-2 text-center">
        {/* Dấu mộc lật 3D: ghim bản đồ */}
        <div className="stamp-flip">
          <div className="grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-gradient-to-b from-[#FF7CB0] to-accent text-white shadow-[0_7px_0_var(--accent-press),0_22px_30px_-12px_rgba(194,46,108,0.6)]">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 21.5s-7-6-7-11.6a7 7 0 0 1 14 0c0 5.6-7 11.6-7 11.6z"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="9.8" r="2.6" fill="currentColor" />
            </svg>
          </div>
        </div>
        <StageTag className="mt-6">Nhiệm vụ {order}</StageTag>
        <h2 className="display-title display-hero mt-3 text-[42px]">Đúng rồi!</h2>
        <p className="mt-3 max-w-[30ch] text-[17px] leading-relaxed text-balance text-ink/85">
          Bạn đã chọn đúng địa điểm. Di chuyển đến đây để nhận nhiệm vụ tiếp theo.
        </p>
        <div className="mt-6 w-full">
          <PlaceCard place={place} label="Điểm đến" />
        </div>
        <p className="lvl-status mt-4">{"Đến trong vòng 1\u00a0km, gợi\u00a0ý tìm mã QR sẽ hiện ra."}</p>
        <button className="btn btn-primary mt-6 w-full" onClick={onClose}>
          Lên đường thôi
        </button>
      </div>
    </Sheet>
  );
}
