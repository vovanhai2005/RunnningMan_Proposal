"use client";
import { useEffect, useState } from "react";
import { Spinner } from "./ui";

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

  const rules = [
    { icon: "📍", text: "Mỗi nhiệm vụ có một điểm đến trên bản đồ." },
    { icon: "📷", text: "Đến nơi, Ban tổ chức đưa bạn một mã QR. Bấm “Quét mã” để nhận câu đố." },
    { icon: "🧩", text: "Trả lời đúng để mở khóa điểm đến tiếp theo." },
    { icon: "🏁", text: `Hoàn thành toàn bộ các nhiệm vụ để về đích.` },
  ];

  return (
    <main className="app-screen race-stripes flex flex-col overflow-y-auto text-white">
      <div className="flex flex-1 flex-col px-6 pt-10 pb-6">
        <div className="pop-in">
          <div className="text-[15px] font-bold uppercase tracking-[0.18em] text-yellow">
            Xin chào, {name}!
          </div>
          <h1 className="race-title mt-3 text-[46px]">
            Chào mừng
            <br />
            đến với
            <br />
            <span className="text-accent">cuộc đua</span>
          </h1>
        </div>

        <ol className="mt-8 flex flex-col gap-3">
          {rules.map((r, i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl bg-white/[0.07] p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-xl">
                {r.icon}
              </span>
              <span className="pt-1.5 text-[16px] leading-snug text-white/90">{r.text}</span>
            </li>
          ))}
        </ol>

        <p className="mt-5 text-[15px] text-white/60">
          Khi điện thoại hỏi, hãy cho phép dùng <b className="text-white/85">vị trí</b> và{" "}
          <b className="text-white/85">la bàn</b>. Màn hình sẽ luôn sáng trong suốt cuộc đua.
        </p>

        <div className="mt-auto pt-8">
          <button
            className="btn btn-primary w-full text-[20px]"
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
          <p className="mt-4 text-center text-[13px] text-white/45">— Ban tổ chức —</p>
        </div>
      </div>
    </main>
  );
}
