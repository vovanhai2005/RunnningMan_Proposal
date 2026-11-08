"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistance, formatEta } from "@/lib/format";
import type { GameState } from "@/lib/types";
import type { Fix, GeoStatus } from "@/hooks/useGeolocation";
import { useRouteProgress } from "@/hooks/useRouteProgress";
import { MapErrorBoundary } from "./map/MapErrorBoundary";
import { StageTag } from "./ui";

const MapLibreMapView = dynamic(() => import("./map/MapLibreMapView"), { ssr: false });
const SimpleMapView = dynamic(() => import("./map/SimpleMapView"), { ssr: false });

export function RaceScreen({
  state,
  fix,
  geoStatus,
  heading,
  online,
  onScan,
  onOpenPuzzle,
  onLocationHelp,
}: {
  state: GameState;
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
    <main className="app-screen !p-0 bg-sky">
      {!mapFailed ? (
        <MapErrorBoundary onError={onMapFail}>
          <MapLibreMapView {...mapProps} onFail={onMapFail} />
        </MapErrorBoundary>
      ) : (
        <SimpleMapView {...mapProps} />
      )}

      {/* Thông báo trạng thái */}
      <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+8px)] z-10 flex flex-col gap-2">
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
          className="btn btn-float absolute right-3 z-10 fade-in"
        >
          <span className="text-peri-deep">◎</span> Về vị trí của tôi
        </button>
      )}

      {/* Thẻ nhiệm vụ ở đáy, trong vùng ngón cái */}
      <div
        ref={cardRef}
        className="absolute inset-x-0 bottom-0 z-20 rounded-t-[32px] border-t-[5px] border-butter bg-paper px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-14px_36px_-10px_rgba(43,33,96,0.35)]"
      >
        <div className="flex items-center justify-between gap-3">
          <StageTag>Nhiệm vụ {stage.order}</StageTag>
          {stage.route?.approximate && (
            <span className="text-[12px] text-muted">Đường ước lượng</span>
          )}
        </div>
        <h1 className="display-title mt-2.5 text-[27px]">{stage.title}</h1>

        <div className="mt-3 flex items-end gap-4">
          {remaining != null ? (
            <>
              <div>
                <div className="text-[13px] font-medium text-muted">Còn lại</div>
                <div className="num-display text-[38px] text-accent [text-shadow:0_2px_0_var(--accent-soft)]">
                  {formatDistance(remaining)}
                </div>
              </div>
              <div className="pb-0.5 text-[16px] font-medium text-muted">
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
          <p className="mt-3 rounded-2xl bg-[#FFF3C4] px-4 py-2.5 text-[15px] font-medium text-[#6B5000] fade-in">
            ✨ Sắp đến nơi! Tìm người của Ban tổ chức để nhận mã QR.
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
      className={`rounded-2xl px-4 py-3 text-[15px] shadow-[0_8px_24px_-10px_rgba(43,33,96,0.45)] backdrop-blur fade-in ${
        tone === "dark" ? "bg-[#2B2160]/90 text-white" : "bg-[#FFF3C4]/95 text-[#6B5000]"
      }`}
    >
      {children}
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
