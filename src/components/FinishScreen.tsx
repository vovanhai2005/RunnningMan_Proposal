"use client";
import { useEffect } from "react";
import { formatClock } from "@/lib/format";
import { celebrate } from "@/client/device";
import { sfx } from "@/client/sound";

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
    <main className="app-screen race-stripes flex flex-col items-center justify-center px-8 text-center text-white">
      <div className="pop-in text-[84px] leading-none">🏁</div>
      <h1 className="race-title mt-8 text-[44px]">
        Bạn đã
        <br />
        hoàn thành
        <br />
        <span className="text-yellow">cuộc đua</span>
      </h1>
      {total != null && total > 0 && (
        <div className="mt-8 rounded-full bg-white/10 px-5 py-2 font-bold tabular-nums text-white/80">
          ⏱ {formatClock(total)}
        </div>
      )}
    </main>
  );
}
