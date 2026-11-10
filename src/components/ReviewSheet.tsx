"use client";
import type { CompletedStage } from "@/lib/types";
import { Sheet, StageTag } from "./ui";

/** Quét lại mã QR của màn đã xong: xem lại địa điểm, gợi ý và lời nhắn */
export function ReviewSheet({ stage, onClose }: { stage: CompletedStage; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="mt-2 flex items-center gap-2 pr-24">
        <StageTag>Nhiệm vụ {stage.order}</StageTag>
        <span className="text-[14px] font-semibold text-ok">Đã tìm thấy</span>
      </div>
      <h2 className="display-title mt-3 text-[27px]">{stage.title}</h2>

      <div className="mt-4 whitespace-pre-line rounded-3xl border-2 border-dashed border-butter-deep/40 bg-cream p-5 text-[18px] leading-relaxed">
        {stage.clue.text}
        {stage.clue.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stage.clue.imageUrl}
            alt="Hình gợi ý địa điểm"
            className="mt-3 w-full rounded-2xl"
          />
        )}
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
