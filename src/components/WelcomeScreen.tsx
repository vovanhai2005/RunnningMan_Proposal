"use client";
import { useEffect, useState } from "react";
import { CandyName, Ribbon, Sparkles, Spinner } from "./ui";

export function WelcomeScreen({
  name,
  avatarUrl,
  onStart,
}: {
  name: string;
  avatarUrl: string | null;
  onStart: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  // Tải sẵn ảnh avatar từ màn chào mừng (mục 6b)
  useEffect(() => {
    if (!avatarUrl) return;
    const img = new Image();
    img.src = avatarUrl;
  }, [avatarUrl]);

  // Các bước là một trình tự thật, nên đánh số và nối nhau như một lộ trình
  const rules = [
    "Mỗi màn có một gợi ý về một địa điểm bí mật. Đoán xem đó là đâu rồi đi tới đó.",
    "Khi bạn đến trong vòng 1 km, app sẽ báo cho bạn.",
    "Tìm mã QR bí mật quanh đó và bấm “Quét mã QR” để nhận gợi ý địa điểm tiếp theo.",
    "Qua hết các màn để về đích.",
  ];

  return (
    <main className="app-screen sky flex flex-col overflow-y-auto">
      <Sparkles />
      <div className="relative flex flex-1 flex-col px-5 pt-7 pb-5">
        {/* "Chào mừng <tên> đến với cuộc đua": một câu, tên là nhân vật chính */}
        <h1 className="flex flex-col items-center text-center">
          <Ribbon className="ribbon-in">Chào mừng</Ribbon>
          <CandyName name={name} className="mt-3" />
          <span className="candy-sub mt-1 text-[26px]">đến với cuộc đua</span>
        </h1>

        <ol className="candy-panel relative mt-7 flex flex-col gap-3.5 px-4 py-5">
          {rules.map((text, i) => (
            <li key={i} className="relative flex items-start gap-3.5">
              <span className={`gumdrop num-display ${i === rules.length - 1 ? "gumdrop-pink" : ""}`}>
                {i + 1}
              </span>
              <span className="pt-1 text-[16px] leading-snug text-ink/90">{text}</span>
            </li>
          ))}
        </ol>

        <p className="mt-4 px-2 text-[14.5px] leading-snug text-muted">
          Khi điện thoại hỏi, hãy cho phép dùng <b className="text-ink">vị trí</b> và{" "}
          <b className="text-ink">la bàn</b>. Màn hình sẽ luôn sáng trong suốt cuộc đua.
        </p>

        <div className="mt-auto pt-6">
          <button
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onStart();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner /> : "Bắt đầu cuộc đua"}
          </button>
        </div>
      </div>
    </main>
  );
}
