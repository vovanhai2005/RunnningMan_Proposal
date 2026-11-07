"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cumulativeLengths, haversine, projectOnRoute, type LatLng } from "@/lib/geo";
import type { PublicRoute } from "@/lib/types";

export type RouteProgress = {
  /** Quãng đường còn lại (m): dọc tuyến + khoảng cách từ avatar tới tuyến */
  remainingM: number;
  /** Thời gian dự kiến (s): thời gian Google ước × tỉ lệ quãng đường còn lại */
  etaS: number;
  /** Đoạn tuyến đã đi tới (để tách phần đã đi / còn lại) */
  segIndex: number;
  splitPoint: LatLng;
  /** Khoảng cách từ avatar tới tuyến */
  offRouteM: number;
  /** Khoảng cách chim bay tới đích */
  directM: number;
};

/** Cách tuyến hơn 300 m thì vẽ thêm đoạn nét đứt tới tuyến (mục 6b) */
export const OFF_ROUTE_M = 300;

/**
 * Tính quãng đường/thời gian còn lại ngay trên điện thoại, không gọi API.
 * Mỗi 5 giây khi còn trên 5 km, mỗi 3 giây khi gần hơn.
 */
export function useRouteProgress(
  route: PublicRoute | null,
  dest: LatLng | null,
  pos: LatLng | null,
): RouteProgress | null {
  const cum = useMemo(() => (route ? cumulativeLengths(route.points) : null), [route]);
  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  const [progress, setProgress] = useState<RouteProgress | null>(null);
  const hasPos = pos != null;

  useEffect(() => {
    if (!dest || !hasPos) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const p = posRef.current;
      let next: RouteProgress | null = null;
      if (p) {
        const directM = haversine(p, dest);
        if (route && cum && route.points.length > 1) {
          const proj = projectOnRoute(route.points, cum, p)!;
          const total = cum[cum.length - 1] || 1;
          const remainingM = proj.alongRemainingM + proj.offRouteM;
          // Quãng đường Google tính có thể khác độ dài tuyến đã rút gọn: quy về tỉ lệ
          const scale = route.distanceM > 0 ? route.distanceM / total : 1;
          const ratio = Math.min(1, proj.alongRemainingM / total);
          next = {
            remainingM: proj.alongRemainingM * scale + proj.offRouteM,
            etaS:
              route.durationS > 0
                ? route.durationS * ratio + proj.offRouteM / (30 / 3.6)
                : remainingM / (35 / 3.6),
            segIndex: proj.segIndex,
            splitPoint: proj.point,
            offRouteM: proj.offRouteM,
            directM,
          };
        } else {
          next = {
            remainingM: directM,
            etaS: (directM * 1.3) / (35 / 3.6),
            segIndex: 0,
            splitPoint: p,
            offRouteM: 0,
            directM,
          };
        }
      }
      setProgress(next);
      timer = setTimeout(tick, next && next.remainingM > 5000 ? 5000 : 3000);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [route, cum, dest, hasPos]);

  return dest && hasPos ? progress : null;
}
