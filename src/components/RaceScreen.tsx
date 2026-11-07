"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatClock, formatDistance, formatEta } from "@/lib/format";
import type { GameState } from "@/lib/types";
import type { Fix, GeoStatus } from "@/hooks/useGeolocation";
import { useRouteProgress } from "@/hooks/useRouteProgress";
import { MapErrorBoundary } from "./map/MapErrorBoundary";
import { Kicker } from "./ui";

const MapLibreMapView = dynamic(() => import("./map/MapLibreMapView"), { ssr: false });
const SimpleMapView = dynamic(() => import("./map/SimpleMapView"), { ssr: false });

export function RaceScreen({
  state,
  clockOffsetMs,
  fix,
  geoStatus,
  heading,
  online,
  onScan,
  onOpenPuzzle,
  onLocationHelp,
}: {
  state: GameState;
  clockOffsetMs: number;
  fix: Fix | null;
  geoStatus: GeoStatus;
  heading: number | null;
  online: boolean;
  onScan: () => void;
  onOpenPuzzle: () => void;
  onLocationHelp: () => void;
}) {
  const stage = state.stage!;
  const dest = useMemo(() => ({ lat: stage.lat, lng: stage.lng }), [stage.lat, stage.lng]);
  const pos = useMemo(() => (fix ? { lat: fix.lat, lng: fix.lng } : null), [fix]);
  const progress = useRouteProgress(stage.route, dest, pos);
  const [following, setFollowing] = useState(true);
  const [mapFailed, setMapFailed] = useState(false);
  const onMapFail = useCallback(() => setMapFailed(true), []);
  const onUserPan = useCallback(() => setFollowing(false), []);

  // Đổi chặng: bám theo avatar lại từ đầu
  const [prevOrder, setPrevOrder] = useState(stage.order);
  if (prevOrder !== stage.order) {
    setPrevOrder(stage.order);
    setFollowing(true);
  }

  // Đo chiều cao thẻ nhiệm vụ để bản đồ chừa chỗ
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(260);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const remaining = progress?.remainingM ?? null;
  const near = remaining != null && remaining < 1000;
  const arriving = remaining != null && remaining < 250;
  const solving = state.status === "solving";

  const mapProps = {
    stageKey: stage.order,
    dest,
    route: stage.route,
    avatarPos: pos,
    heading,
    avatarUrl: state.player.avatarUrl,
    progress,
    near,
    following,
    onUserPan,
    bottomInset: cardH,
  };

  return (
    <main className="app-screen !p-0 bg-[#EAF0E6]">
      {!mapFailed ? (
        <MapErrorBoundary onError={onMapFail}>
          <MapLibreMapView {...mapProps} onFail={onMapFail} />
        </MapErrorBoundary>
      ) : (
        <SimpleMapView {...mapProps} />
      )}

      {/* Thanh trên: đồng hồ cuộc đua + tiến độ */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
        <RaceClock startedAt={state.player.startedAt} offsetMs={clockOffsetMs} />
        <StageDots total={state.totalStages} current={stage.order} />
      </div>

      {/* Thông báo trạng thái */}
      <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+60px)] z-10 flex flex-col gap-2">
        {!online && (
          <Banner tone="dark">
            📶 Mất sóng — bản đồ vẫn chạy, tiến trình đã được lưu. Có mạng lại là chơi tiếp.
          </Banner>
        )}
        {geoStatus === "insecure" && (
          <Banner tone="warn">
            📍 Không lấy được vị trí vì trang đang mở bằng <b>http://</b>. Định vị chỉ chạy khi mở
            bằng link <b>https://</b> của Ban tổ chức. Bạn vẫn chơi được bằng cách quét mã.
          </Banner>
        )}
        {(geoStatus === "denied" || geoStatus === "unavailable") && (
          <button onClick={onLocationHelp} className="text-left">
            <Banner tone="warn">
              📍 {geoStatus === "denied" ? "Vị trí đang tắt." : "Chưa lấy được vị trí."}{" "}
              <u className="font-bold">Xem cách bật</u>
            </Banner>
          </button>
        )}
      </div>

      {/* Nút về vị trí của tôi */}
      {!following && (
        <button
          onClick={() => setFollowing(true)}
          style={{ bottom: cardH + 14 }}
          className="btn btn-dark absolute right-3 z-10 shadow-lg fade-in"
        >
          ◎ Về vị trí của tôi
        </button>
      )}

      {/* Thẻ nhiệm vụ ở đáy, trong vùng ngón cái */}
      <div
        ref={cardRef}
        className="absolute inset-x-0 bottom-0 z-20 rounded-t-[28px] bg-paper px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-8px_30px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center justify-between">
          <Kicker>
            Nhiệm vụ {stage.order}/{state.totalStages}
          </Kicker>
          {stage.route?.approximate && (
            <span className="text-[12px] text-muted">Đường ước lượng</span>
          )}
        </div>
        <h1 className="mt-1 text-[24px] font-extrabold leading-tight">{stage.title}</h1>

        <div className="mt-3 flex items-end gap-4">
          {remaining != null ? (
            <>
              <div>
                <div className="text-[13px] font-semibold text-muted">Còn lại</div>
                <div className="text-[30px] font-black leading-none tabular-nums">
                  {formatDistance(remaining)}
                </div>
              </div>
              <div className="pb-0.5 text-[16px] font-semibold text-muted">
                {formatEta(progress!.etaS)}
              </div>
            </>
          ) : (
            <div className="text-[16px] text-muted">
              {geoStatus === "waiting" || geoStatus === "idle"
                ? "Đang tìm vị trí của bạn…"
                : geoStatus === "insecure"
                  ? "Cần mở bằng link https:// để xem quãng đường còn lại."
                  : "Bật vị trí để xem quãng đường còn lại."}
            </div>
          )}
        </div>

        {arriving && !solving && (
          <p className="mt-3 rounded-xl bg-[#FFF3E8] px-3 py-2 text-[15px] font-semibold text-[#A33A00] fade-in">
            Sắp đến nơi! Tìm người của Ban tổ chức để nhận mã QR.
          </p>
        )}

        {solving ? (
          <div className="mt-4 flex gap-3">
            <button className="btn btn-primary flex-1" onClick={onOpenPuzzle}>
              🧩 Mở câu đố
            </button>
          </div>
        ) : (
          <button className="btn btn-primary mt-4 w-full" onClick={onScan}>
            <QrIcon /> Quét mã
          </button>
        )}
      </div>
    </main>
  );
}

function Banner({ children, tone }: { children: React.ReactNode; tone: "dark" | "warn" }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-[15px] shadow-lg fade-in ${
        tone === "dark" ? "bg-ink/90 text-white" : "bg-[#FFF4D6] text-[#5C4100]"
      }`}
    >
      {children}
    </div>
  );
}

function RaceClock({ startedAt, offsetMs }: { startedAt: string | null; offsetMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!startedAt) return <span />;
  const elapsed = now + offsetMs - new Date(startedAt).getTime();
  return (
    <div className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full bg-ink/90 px-4 text-[17px] font-bold text-white tabular-nums shadow-lg">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
      {formatClock(elapsed)}
    </div>
  );
}

function StageDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex min-h-11 items-center gap-1.5 rounded-full bg-ink/90 px-4 shadow-lg">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const cls =
          n < current
            ? "bg-ok"
            : n === current
              ? "bg-accent ring-2 ring-accent/40 ring-offset-0 w-5"
              : "bg-white/25";
        return <span key={n} className={`h-2.5 w-2.5 rounded-full transition-all ${cls}`} />;
      })}
    </div>
  );
}

function QrIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}
