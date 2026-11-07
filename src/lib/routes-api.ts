import { haversine, simplify, type LatLng, type Pt } from "./geo";

/**
 * Tính đường lái xe (dùng chung cho server và script quản trị; không import ở trình duyệt).
 * Thứ tự thử: OpenRouteService (nếu có khóa miễn phí) → OSRM công cộng → đường thẳng ước lượng.
 * Cả buổi chỉ cần khoảng 4–5 lượt: chặng 2–4 tính sẵn bằng `content:push`, chặng 1 lúc bấm "Bắt đầu".
 */

export type ComputedRoute = {
  points: Pt[];
  distanceM: number;
  durationS: number;
  /** true khi không tính được đường thật và phải dùng đường thẳng ước lượng */
  approximate: boolean;
  source: "openrouteservice" | "osrm" | "straight";
};

export type RouterOptions = { orsKey?: string; timeoutMs?: number };

const USER_AGENT = "race-app/1.0 (private one-day event)";

/** Tọa độ GeoJSON [lng, lat] → điểm [lat, lng], rút gọn Douglas–Peucker ~15 m */
function finish(coords: [number, number][]): Pt[] {
  const pts = coords.map(([lng, lat]) => [round6(lat), round6(lng)] as Pt);
  return simplify(pts, 15);
}

/** OpenRouteService — cần khóa miễn phí (openrouteservice.org, 2.000 lượt/ngày) */
export async function routeWithOrs(o: LatLng, d: LatLng, key: string, timeoutMs = 12000) {
  const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({
      coordinates: [
        [o.lng, o.lat],
        [d.lng, d.lat],
      ],
      // Điểm cách đường tới 1 km vẫn bắt được (mặc định 350 m)
      radiuses: [1000, 1000],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`OpenRouteService ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    features?: {
      geometry: { coordinates: [number, number][] };
      properties: { summary?: { distance?: number; duration?: number } };
    }[];
  };
  const f = data.features?.[0];
  if (!f?.geometry?.coordinates?.length) throw new Error("OpenRouteService: không có đường đi");
  return {
    points: finish(f.geometry.coordinates),
    distanceM: Math.round(f.properties.summary?.distance ?? 0),
    durationS: Math.round(f.properties.summary?.duration ?? 0),
    approximate: false,
    source: "openrouteservice" as const,
  };
}

/** Máy chủ OSRM công cộng — không cần khóa, nhưng không cam kết luôn chạy */
export async function routeWithOsrm(o: LatLng, d: LatLng, timeoutMs = 12000) {
  const base = process.env.OSRM_URL || "https://router.project-osrm.org";
  const url = `${base}/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`OSRM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    code: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r) throw new Error(`OSRM: ${data.code}`);
  return {
    points: finish(r.geometry.coordinates),
    distanceM: Math.round(r.distance),
    durationS: Math.round(r.duration),
    approximate: false,
    source: "osrm" as const,
  };
}

/** Đường thẳng ước lượng khi không tính được đường thật (mất mạng, dịch vụ lỗi). */
export function straightRoute(origin: LatLng, destination: LatLng): ComputedRoute {
  const d = haversine(origin, destination);
  const steps = Math.max(1, Math.ceil(d / 200));
  const points: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push([
      round6(origin.lat + (destination.lat - origin.lat) * t),
      round6(origin.lng + (destination.lng - origin.lng) * t),
    ]);
  }
  const distanceM = Math.round(d * 1.3); // đường thực thường dài hơn đường chim bay
  return {
    points,
    distanceM,
    durationS: Math.round(distanceM / (35 / 3.6)),
    approximate: true,
    source: "straight",
  };
}

/** Đường lái xe thật; ném lỗi nếu mọi dịch vụ đều thất bại. */
export async function computeDriveRoute(
  origin: LatLng,
  destination: LatLng,
  opts: RouterOptions = {},
): Promise<ComputedRoute> {
  const errors: string[] = [];
  if (opts.orsKey) {
    try {
      return await routeWithOrs(origin, destination, opts.orsKey, opts.timeoutMs);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  // Máy chủ OSRM công cộng đôi khi lỗi thoáng qua: thử tối đa 2 lần
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await routeWithOsrm(origin, destination, opts.timeoutMs);
    } catch (e) {
      const err = e as Error & { cause?: { code?: string } };
      errors.push(`${err.message}${err.cause?.code ? ` (${err.cause.code})` : ""}`);
    }
  }
  throw new Error(errors.join(" | "));
}

/** Như trên nhưng không bao giờ thất bại: lỗi thì trả về đường thẳng ước lượng. */
export async function computeRouteOrFallback(
  origin: LatLng,
  destination: LatLng,
  opts: RouterOptions = {},
): Promise<ComputedRoute> {
  try {
    return await computeDriveRoute(origin, destination, opts);
  } catch (e) {
    console.error("[routes] dùng đường thẳng thay thế:", (e as Error).message);
    return straightRoute(origin, destination);
  }
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
