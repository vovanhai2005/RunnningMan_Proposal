/** Hình học tuyến đường dùng chung cho server (rút gọn) và trình duyệt (quãng đường còn lại). */

export type LatLng = { lat: number; lng: number };
/** Điểm gọn để lưu/gửi: [lat, lng] */
export type Pt = [number, number];

const R = 6371008.8; // bán kính Trái Đất (m)
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export const pt2ll = (p: Pt): LatLng => ({ lat: p[0], lng: p[1] });

/** Hướng (độ, 0 = Bắc, theo chiều kim đồng hồ) từ a đến b. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Chiếu phẳng cục bộ (equirectangular) quanh một vĩ độ tham chiếu, đơn vị mét.
 * Sai số không đáng kể ở quy mô vài trăm km.
 */
function projector(refLat: number) {
  const k = Math.cos(toRad(refLat));
  return (p: Pt) => [toRad(p[1]) * R * k, toRad(p[0]) * R] as const;
}

/** Rút gọn Douglas–Peucker, sai số `toleranceM` mét (mục 6b: khoảng 15 m). */
export function simplify(points: Pt[], toleranceM = 15): Pt[] {
  if (points.length <= 2) return points.slice();
  const proj = projector(points[0][0]);
  const xy = points.map(proj);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  const tol2 = toleranceM * toleranceM;
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist2(xy[i], xy[s], xy[e]).d2;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > tol2) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

type XY = readonly [number, number];
function segDist2(p: XY, a: XY, b: XY): { d2: number; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx - p[0];
  const y = a[1] + t * dy - p[1];
  return { d2: x * x + y * y, t };
}

/** Độ dài cộng dồn từ đầu tuyến tới từng điểm (m). */
export function cumulativeLengths(route: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < route.length; i++) {
    out.push(out[i - 1] + haversine(pt2ll(route[i - 1]), pt2ll(route[i])));
  }
  return out;
}

export type RouteProjection = {
  /** Chỉ số đoạn [segIndex, segIndex+1] chứa điểm gần nhất */
  segIndex: number;
  /** Điểm gần nhất trên tuyến */
  point: LatLng;
  /** Khoảng cách từ vị trí tới tuyến (m) */
  offRouteM: number;
  /** Quãng đường dọc tuyến từ điểm gần nhất tới đích (m) */
  alongRemainingM: number;
};

/** Tìm điểm gần nhất trên tuyến và quãng đường còn lại dọc tuyến. */
export function projectOnRoute(route: Pt[], cum: number[], pos: LatLng): RouteProjection | null {
  if (route.length === 0) return null;
  if (route.length === 1) {
    const point = pt2ll(route[0]);
    return { segIndex: 0, point, offRouteM: haversine(pos, point), alongRemainingM: 0 };
  }
  const proj = projector(pos.lat);
  const p = proj([pos.lat, pos.lng]);
  let best = { d2: Infinity, i: 0, t: 0 };
  let a = proj(route[0]);
  for (let i = 0; i < route.length - 1; i++) {
    const b = proj(route[i + 1]);
    const r = segDist2(p, a, b);
    if (r.d2 < best.d2) best = { d2: r.d2, i, t: r.t };
    a = b;
  }
  const s = route[best.i];
  const e = route[best.i + 1];
  const point = { lat: s[0] + (e[0] - s[0]) * best.t, lng: s[1] + (e[1] - s[1]) * best.t };
  const segLen = cum[best.i + 1] - cum[best.i];
  const total = cum[cum.length - 1];
  const along = total - (cum[best.i] + segLen * best.t);
  return {
    segIndex: best.i,
    point,
    offRouteM: haversine(pos, point),
    alongRemainingM: Math.max(0, along),
  };
}

/** Nội suy giữa hai tọa độ (để avatar trượt mượt). */
export function lerpLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}
