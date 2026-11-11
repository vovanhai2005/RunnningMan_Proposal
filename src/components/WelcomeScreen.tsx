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

  // Mỗi bước có biểu tượng riêng thay cho số 1–4: số thứ tự trông như số màn chơi và làm lộ
  // tổng số nhiệm vụ (bản đồ cố ý giấu điều này).
  const rules: { icon: RuleIcon; text: string }[] = [
    {
      icon: "clue",
      text: "Màn đầu tiên là một gợi ý về địa điểm bí mật. Đoán xem đó là đâu rồi đi tới đó.",
    },
    { icon: "near", text: "Khi bạn đến trong vòng 1 km, app sẽ báo cho bạn." },
    {
      icon: "qr",
      text: "Tìm mã QR bí mật quanh đó và bấm “Quét mã QR” để biết điểm đến tiếp theo.",
    },
    { icon: "flag", text: "Cứ thế đi tiếp cho tới khi về đích." },
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
          {rules.map(({ icon, text }) => (
            <li key={icon} className="relative flex items-start gap-3.5">
              <span className={`gumdrop ${icon === "flag" ? "gumdrop-pink" : ""}`} aria-hidden="true">
                <RuleGlyph icon={icon} />
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

type RuleIcon = "clue" | "near" | "qr" | "flag";

/** Biểu tượng trắng viền nho đặt trên viên kẹo của từng bước */
function RuleGlyph({ icon }: { icon: RuleIcon }) {
  const stroke = { stroke: "var(--grape)", strokeWidth: 1.6, strokeLinejoin: "round" as const };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      {icon === "clue" && (
        <>
          <path
            d="M8.6 8.6a3.4 3.4 0 1 1 5.2 2.9c-1.1.7-1.8 1.4-1.8 2.7v.6"
            fill="none"
            stroke="var(--grape)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M8.6 8.6a3.4 3.4 0 1 1 5.2 2.9c-1.1.7-1.8 1.4-1.8 2.7v.6"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="12" cy="19.2" r="2.1" fill="#fff" {...stroke} />
        </>
      )}
      {icon === "near" && (
        <>
          <path d="M12 22s7-6.6 7-12a7 7 0 0 0-14 0c0 5.4 7 12 7 12z" fill="#fff" {...stroke} />
          <circle cx="12" cy="10" r="2.6" fill="var(--peri-deep)" />
        </>
      )}
      {icon === "qr" && (
        <>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" fill="#fff" {...stroke} />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" fill="#fff" {...stroke} />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" fill="#fff" {...stroke} />
          <rect x="14" y="14" width="3" height="3" rx="0.6" fill="#fff" {...stroke} />
          <rect x="17.5" y="17.5" width="3" height="3" rx="0.6" fill="#fff" {...stroke} />
        </>
      )}
      {icon === "flag" && (
        <>
          <path d="M5.5 21.5V3" stroke="var(--grape)" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M6 3.8h12.5l-2.6 4.4 2.6 4.4H6z" fill="#fff" {...stroke} />
        </>
      )}
    </svg>
  );
}
