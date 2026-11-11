"use client";
import type { CompletedStage } from "@/lib/types";
import { PlaceCard } from "./PlaceCard";
import { Sheet, StageTag } from "./ui";

/** Quét lại mã QR của màn đã xong: xem lại địa điểm, gợi ý và lời nhắn */
export function ReviewSheet({ stage, onClose }: { stage: CompletedStage; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="mt-2 flex items-center gap-2 pr-24">
        <StageTag>Nhiệm vụ {stage.order}</StageTag>
        <span className="text-[14px] font-semibold text-ok">Đã tìm thấy</span>
      </div>
      <div className="mt-6">
        <PlaceCard place={stage.place} label="Địa điểm" mode="view" />
      </div>

      {stage.successMessage && (
        <p className="mt-4 whitespace-pre-line text-[17px] leading-relaxed text-ink/85">
          {stage.successMessage}
        </p>
      )}

      <button className="btn btn-ghost mt-6 w-full" onClick={onClose}>
        Đóng
      </button>
    </Sheet>
  );
}
