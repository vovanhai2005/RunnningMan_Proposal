"use client";
import { Sheet } from "./ui";

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
    <Sheet tone="dark">
      <div className="flex flex-col items-center px-2 pt-4 text-center">
        <div className="pop-in grid h-24 w-24 place-items-center rounded-full bg-ok text-5xl text-white shadow-[0_0_0_10px_rgba(18,161,80,0.25)]">
          ✓
        </div>
        <div className="mt-5 text-[13px] font-extrabold uppercase tracking-[0.16em] text-yellow">
          Nhiệm vụ {order} hoàn thành
        </div>
        <h2 className="race-title mt-2 text-[40px]">Chính xác!</h2>
        <p className="mt-4 whitespace-pre-line text-[18px] text-white/85">{message}</p>
        <p className="mt-3 text-[13px] text-white/45">— Ban tổ chức —</p>
        <button className="btn btn-primary mt-8 w-full" onClick={onContinue}>
          {isLast ? "Về đích 🏁" : `Đến nhiệm vụ ${order + 1}`}
        </button>
      </div>
    </Sheet>
  );
}
