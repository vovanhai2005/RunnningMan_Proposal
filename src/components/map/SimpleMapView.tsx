"use client";
import { useEffect, useRef, useState } from "react";
import { pt2ll, type LatLng } from "@/lib/geo";
import { OFF_ROUTE_M } from "@/hooks/useRouteProgress";
import type { MapViewProps } from "./types";

/**
 * Bản đồ dự phòng bằng SVG: dùng khi bản đồ OpenStreetMap không tải được
 * (mất mạng lúc mở trang, máy chủ bản đồ lỗi, máy không hỗ trợ WebGL). Vẫn hiện đường đi, điểm đến và avatar để cuộc chơi không dừng.
 */
export default function SimpleMapView({
  dest,
  route,
  avatarPos,
  heading,
  avatarUrl,
  progress,
  near,
  bottomInset,
}: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 430, h: 800 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts: LatLng[] = route?.points.map(pt2ll) ?? [];
  const all = [...pts, dest, ...(avatarPos ? [avatarPos] : [])];
  const minLat = Math.min(...all.map((p) => p.lat));
  const maxLat = Math.max(...all.map((p) => p.lat));
  const minLng = Math.min(...all.map((p) => p.lng));
  const maxLng = Math.max(...all.map((p) => p.lng));
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * k, 0.002);
  const spanY = Math.max(maxLat - minLat, 0.002);
  const pad = { top: 110, bottom: bottomInset + 40, left: 48, right: 48 };
  const availW = Math.max(50, size.w - pad.left - pad.right);
  const availH = Math.max(50, size.h - pad.top - pad.bottom);
  const scale = Math.min(availW / spanX, availH / spanY);
  const cx = (minLng + maxLng) / 2;
  const cy = (minLat + maxLat) / 2;
  const toXY = (p: LatLng) => ({
    x: pad.left + availW / 2 + (p.lng - cx) * k * scale,
    y: pad.top + availH / 2 - (p.lat - cy) * scale,
  });
  const path = (list: LatLng[]) =>
    list.map((p, i) => `${i ? "L" : "M"}${toXY(p).x.toFixed(1)},${toXY(p).y.toFixed(1)}`).join(" ");

  const seg = progress?.segIndex ?? 0;
  const split = progress?.splitPoint;
  const traveled = split ? [...pts.slice(0, seg + 1), split] : [];
  const remaining = split ? [split, ...pts.slice(seg + 1)] : pts;
  const d = toXY(dest);
  const a = avatarPos ? toXY(avatarPos) : null;

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-[#EAF0E6]">
      <svg width={size.w} height={size.h} className="absolute inset-0" aria-hidden="true">
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="#D5DED0" strokeWidth="1" />
          </pattern>
          <clipPath id="avatar-clip">
            <circle cx="0" cy="0" r="22" />
          </clipPath>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {traveled.length > 1 && (
          <path d={path(traveled)} fill="none" stroke="#8A8F9C" strokeOpacity={0.55} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {remaining.length > 1 && (
          <>
            {!route?.approximate && (
              <path d={path(remaining)} fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
            )}
            <path
              d={path(remaining)}
              fill="none"
              stroke="#FF5B14"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={route?.approximate ? "2 12" : undefined}
            />
          </>
        )}
        {a && progress && split && progress.offRouteM > OFF_ROUTE_M && (
          <path d={path([avatarPos!, split])} stroke="#14161F" strokeWidth={3} strokeDasharray="4 8" strokeLinecap="round" />
        )}
        <g transform={`translate(${d.x},${d.y})`}>
          {near && (
            <circle r="18" fill="#FF5B14" className="rm-svg-pulse" />
          )}
          <circle r="20" fill="#14161F" stroke="#fff" strokeWidth="3" />
          <path transform="translate(-11,-11) scale(0.92)" fill="#FFC727" d="M5 21V4h9.2l.4 2H20v10h-6.6l-.4-2H7v7H5Z" />
        </g>
        {a && (
          <g transform={`translate(${a.x},${a.y})`}>
            {heading != null && (
              <path d="M0,-34 L7,-24 L-7,-24 Z" fill="#2D7FF9" transform={`rotate(${heading})`} />
            )}
            <circle r="25" fill="#fff" />
            <image
              href={avatarUrl || "/avatar-demo.svg"}
              x="-22"
              y="-22"
              width="44"
              height="44"
              clipPath="url(#avatar-clip)"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
        )}
      </svg>
      <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+64px)] -translate-x-1/2 whitespace-nowrap rounded-full bg-white/85 px-3 py-1 text-[13px] text-[var(--muted)] shadow-sm">
        Bản đồ đơn giản — đang dùng bản dự phòng
      </div>
    </div>
  );
}
