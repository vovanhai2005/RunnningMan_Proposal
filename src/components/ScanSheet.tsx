"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type QrScannerType from "qr-scanner";
import { Kicker, Sheet, Spinner } from "./ui";

type Submit = (input: { token?: string; code?: string }) => Promise<string | null>;

/**
 * Quét mã QR ngay trong web (Safari iOS không có Barcode Detection API nên dùng thư viện
 * quét bằng JavaScript/WebAssembly). Luôn có phương án nhập mã chữ in dưới QR.
 */
export function ScanSheet({
  stageOrder,
  onSubmit,
  onClose,
  initialError,
}: {
  stageOrder: number;
  onSubmit: Submit;
  onClose: () => void;
  initialError?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const busyRef = useRef(false);
  const [camera, setCamera] = useState<"starting" | "on" | "denied" | "none">("starting");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState("");
  const submitRef = useRef(onSubmit);
  useEffect(() => {
    submitRef.current = onSubmit;
  }, [onSubmit]);

  async function send(input: { token?: string; code?: string }) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    scannerRef.current?.pause();
    const err = await submitRef.current(input);
    busyRef.current = false;
    setBusy(false);
    if (err) {
      setError(err);
      // Cho thời gian đọc thông báo rồi mới quét tiếp
      setTimeout(() => {
        if (!busyRef.current) void scannerRef.current?.start().catch(() => {});
      }, 1500);
    }
  }
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  useEffect(() => {
    if (manual) return;
    let disposed = false;
    (async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const QrScanner = (await import("qr-scanner")).default;
        if (disposed) return;
        if (!(await QrScanner.hasCamera())) {
          setCamera("none");
          return;
        }
        const scanner = new QrScanner(video, (r) => void sendRef.current({ token: r.data }), {
          preferredCamera: "environment",
          maxScansPerSecond: 8,
          returnDetailedScanResult: true,
        });
        scannerRef.current = scanner;
        await scanner.start();
        if (disposed) scanner.destroy();
        else setCamera("on");
      } catch {
        if (!disposed) setCamera("denied");
      }
    })();
    return () => {
      disposed = true;
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [manual]);

  function submitCode(e: FormEvent) {
    e.preventDefault();
    if (code.trim()) void send({ code });
  }

  return (
    <Sheet onClose={onClose}>
      <Kicker className="mt-2">Nhiệm vụ {stageOrder} · Quét mã</Kicker>
      <h2 className="mt-1 pr-20 text-[24px] font-extrabold leading-tight">
        {manual ? "Nhập mã chữ" : "Hướng camera vào mã QR"}
      </h2>

      {!manual && (
        <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-3xl bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {camera === "on" && (
            <div className="pointer-events-none absolute inset-[14%] rounded-3xl border-4 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          )}
          {camera === "starting" && (
            <div className="absolute inset-0 grid place-items-center text-white/80">
              <Spinner />
            </div>
          )}
          {(camera === "denied" || camera === "none") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
              <div className="text-4xl">📷</div>
              <p className="font-bold">Không mở được camera trong trang</p>
              <p className="text-[15px] text-white/75">
                Hãy mở app <b>Camera</b> của iPhone và quét mã — trang sẽ tự mở đúng câu đố. Hoặc
                nhập mã chữ in dưới QR.
              </p>
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
              <Spinner className="h-8 w-8" />
            </div>
          )}
        </div>
      )}

      {manual && (
        <form onSubmit={submitCode} className="mt-4 flex flex-col gap-3">
          <p className="text-muted">Mã chữ được in ngay bên dưới mã QR.</p>
          <input
            className="field text-center text-[22px] font-extrabold uppercase tracking-[0.2em]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="VD: RM-4K7Q"
            autoFocus
          />
          <button className="btn btn-primary w-full" disabled={busy || !code.trim()}>
            {busy ? <Spinner /> : "Xác nhận mã"}
          </button>
        </form>
      )}

      {error && (
        <div role="alert" className="mt-4 flex gap-3 rounded-2xl bg-[#FDECEE] p-4 text-[#9B1C2C] fade-in">
          <span className="text-xl">⚠️</span>
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <button
        className="btn btn-ghost mt-4 w-full"
        onClick={() => {
          setError(null);
          setManual((m) => !m);
        }}
      >
        {manual ? "Quay lại quét QR" : "Không quét được? Nhập mã chữ"}
      </button>
    </Sheet>
  );
}
