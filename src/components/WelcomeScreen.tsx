"use client";
import { useEffect, useState } from "react";
import { NameTag3D, Sparkles, Spinner } from "./ui";

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
    "Mỗi nhiệm vụ có một điểm đến trên bản đồ.",
    "Đến nơi, Ban tổ chức đưa bạn một mã QR. Bấm “Quét mã” để nhận câu đố.",
    "Trả lời đúng để mở khóa điểm đến tiếp theo.",
    "Hoàn thành toàn bộ các nhiệm vụ để về đích.",
  ];

  return (
    <main className="app-screen sky flex flex-col overflow-y-auto">
      <Sparkles />
      <div className="relative flex flex-1 flex-col px-6 pt-8 pb-5">
        <div className="pop-in mx-2">
          <NameTag3D name={name} />
        </div>

        <h1 className="display-title display-hero mt-9 text-[38px]">Chào mừng đến với cuộc đua</h1>

        <ol className="relative mt-6 flex flex-col gap-4">
          {/* Đường chấm nối các bước */}
          <span
            aria-hidden="true"
            className="absolute top-4 bottom-4 left-[17px] border-l-[3px] border-dotted border-peri/40"
          />
          {rules.map((text, i) => (
            <li key={i} className="relative flex items-start gap-4">
              <span
                className={`num-display grid h-9 w-9 shrink-0 place-items-center rounded-full text-[17px] ${
                  i === rules.length - 1
                    ? "bg-accent text-white shadow-[0_3px_0_var(--accent-press)]"
                    : "bg-white text-peri-deep shadow-[0_3px_0_#cdd1f2]"
                }`}
              >
                {i + 1}
              </span>
              <span className="pt-1 text-[16.5px] leading-snug text-ink/90">{text}</span>
            </li>
          ))}
        </ol>

        <p className="mt-6 rounded-2xl bg-white/70 px-4 py-3 text-[15px] text-muted">
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
          <p className="mt-3 text-center text-[14px] font-medium text-muted">Ban tổ chức chúc bạn chạy vui</p>
        </div>
      </div>
    </main>
  );
}
