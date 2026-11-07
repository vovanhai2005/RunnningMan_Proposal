"use client";
import { useEffect } from "react";
import { formatClock } from "@/lib/format";
import { celebrate } from "@/client/device";
import { sfx } from "@/client/sound";
import { Sparkles } from "./ui";

/** Màn về đích: chỉ hiện "Bạn đã hoàn thành cuộc đua" (theo quyết định đã chốt). */
export function FinishScreen({
  startedAt,
  finishedAt,
  fresh,
}: {
  startedAt: string | null;
  finishedAt: string | null;
  /** Vừa về đích trong phiên này: bắn pháo giấy + nhạc */
  fresh: boolean;
}) {
  useEffect(() => {
    void celebrate();
    if (fresh) sfx.finish();
    const t = setInterval(() => void celebrate(), 6000);
    const stop = setTimeout(() => clearInterval(t), 20000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [fresh]);

  const total =
    startedAt && finishedAt ? new Date(finishedAt).getTime() - new Date(startedAt).getTime() : null;

  return (
    <main className="app-screen sky flex flex-col items-center justify-center px-6 text-center">
      <Sparkles />
      <div className="medal-stage pop-in relative">
        <Medal />
      </div>
      <h1 className="display-title display-hero relative mt-12 text-[40px]">
        Bạn đã hoàn thành cuộc đua
      </h1>
      {total != null && total > 0 && (
        <div className="relative mt-8 flex flex-col items-center">
          <span className="text-[14px] font-medium text-muted">Thời gian của bạn</span>
          <span className="num-display mt-1 rounded-2xl bg-white px-5 py-2 text-[28px] text-ink shadow-[0_4px_0_#cfd3f1]">
            {formatClock(total)}
          </span>
        </div>
      )}
    </main>
  );
}

/** Huy chương 3D: các lớp đĩa xếp theo trục Z tạo độ dày, ruy băng hồng–xanh phía sau */
function Medal() {
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
