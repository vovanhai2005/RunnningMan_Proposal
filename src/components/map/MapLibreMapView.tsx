"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, LngLatBoundsLike, Map as MlMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { haversine, lerpLatLng, pt2ll, type LatLng } from "@/lib/geo";
import { OFF_ROUTE_M } from "@/hooks/useRouteProgress";
import type { MapViewProps } from "./types";

/**
 * Bản đồ OpenStreetMap: MapLibre GL + bản đồ vector của OpenFreeMap (miễn phí, không cần khóa API).
 * Một bản đồ duy nhất cho cả buổi; mọi thứ khác (avatar, đường, camera) cập nhật trên bản đồ đó.
 */
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
const ACCENT = "#FF5B14";
const TOP_INSET = 96;
/** Quá thời gian này mà bản đồ chưa tải xong thì chuyển sang bản dự phòng */
const LOAD_TIMEOUT_MS = 20000;

type Lib = typeof import("maplibre-gl");

const ll = (p: LatLng): [number, number] => [p.lng, p.lat];
const line = (coords: [number, number][]) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "LineString" as const, coordinates: coords },
});

export default function MapLibreMapView({
  stageKey,
  dest,
  route,
  avatarPos,
  heading,
  avatarUrl,
  progress,
  near,
  following,
  onUserPan,
  bottomInset,
  onFail,
}: MapViewProps & { onFail: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const avatarRef = useRef<Marker | null>(null);
  const avatarDirRef = useRef<HTMLDivElement | null>(null);
  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const destRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Giữ giá trị mới nhất cho các callback tạo một lần
  const latest = useRef({ onFail, onUserPan, dest });
  useEffect(() => {
    latest.current = { onFail, onUserPan, dest };
  });

  // --- Tạo bản đồ một lần ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let map: MlMap | null = null;
    const timeout = setTimeout(() => {
      if (!disposed && !map?.loaded()) latest.current.onFail();
    }, LOAD_TIMEOUT_MS);

    (async () => {
      let lib: Lib;
      try {
        lib = await import("maplibre-gl");
        lib.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${lib.getVersion()}`);
      } catch (e) {
        console.error("[map] không tải được MapLibre", e);
        latest.current.onFail();
        return;
      }
      if (disposed) return;
      try {
        map = new lib.Map({
          container,
          style: STYLE_URL,
          center: ll(latest.current.dest),
          zoom: 13,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxPitch: 0,
          fadeDuration: 0,
        });
      } catch (e) {
        // Máy không hỗ trợ WebGL…
        console.error("[map] không tạo được bản đồ", e);
        latest.current.onFail();
        return;
      }
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(
        new lib.AttributionControl({
          compact: true,
          customAttribution: "© OpenStreetMap",
        }),
        "top-right",
      );

      let loaded = false;
      map.on("error", (e) => {
        // Lỗi trước khi tải xong (style/mạng) ⇒ dùng bản dự phòng. Lỗi một vài ô bản đồ sau đó thì bỏ qua.
        if (!loaded) {
          console.error("[map]", e.error);
          latest.current.onFail();
        }
      });

      // Người dùng tự kéo / phóng to: ngừng bám theo (thao tác do code gọi không có originalEvent)
      const userMove = (e: { originalEvent?: unknown }) => {
        if (e.originalEvent) latest.current.onUserPan();
      };
      map.on("dragstart", userMove);
      map.on("zoomstart", userMove);

      // Avatar: ảnh tròn 48pt, viền trắng, mũi tên hướng
      const avatarEl = document.createElement("div");
      avatarEl.innerHTML = '<div class="rm-avatar"><div class="rm-avatar-dir"><span class="rm-avatar-arrow"></span></div><img alt="" draggable="false"></div>';
      avatarDirRef.current = avatarEl.querySelector(".rm-avatar-dir");
      avatarImgRef.current = avatarEl.querySelector("img");
      avatarRef.current = new lib.Marker({ element: avatarEl, anchor: "center" });

      const destEl = document.createElement("div");
      destEl.innerHTML =
        '<div class="rm-dest"><span class="rm-dest-ring"></span><span class="rm-dest-ring rm-dest-ring-2"></span>' +
        '<div class="rm-dest-pin"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M5 21V4h9.2l.4 2H20v10h-6.6l-.4-2H7v7H5Z"/></svg></div></div>';
      destRef.current = new lib.Marker({ element: destEl, anchor: "center" })
        .setLngLat(ll(latest.current.dest))
        .addTo(map);

      map.on("load", () => {
        if (disposed || !map) return;
        loaded = true;
        clearTimeout(timeout);
        // Hiện tên địa danh tiếng Việt (style gốc ưu tiên tên tiếng Anh)
        for (const layer of map.getStyle().layers ?? []) {
          if (layer.type === "symbol" && map.getLayoutProperty(layer.id, "text-field")) {
            map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", "name"], ["get", "name_en"]]);
          }
        }
        const empty = line([]);
        for (const id of ["traveled", "remaining", "offroute"]) {
          map.addSource(id, { type: "geojson", data: empty });
        }
        const round = { "line-cap": "round", "line-join": "round" } as const;
        map.addLayer({ id: "traveled", type: "line", source: "traveled", layout: round, paint: { "line-color": "#8A8F9C", "line-opacity": 0.55, "line-width": 5 } });
        map.addLayer({ id: "remaining-casing", type: "line", source: "remaining", layout: round, paint: { "line-color": "#ffffff", "line-width": 10 } });
        map.addLayer({ id: "remaining", type: "line", source: "remaining", layout: round, paint: { "line-color": ACCENT, "line-width": 6 } });
        map.addLayer({ id: "remaining-approx", type: "line", source: "remaining", layout: { ...round, visibility: "none" }, paint: { "line-color": ACCENT, "line-width": 5, "line-dasharray": [0.1, 2.5] } });
        map.addLayer({ id: "offroute", type: "line", source: "offroute", layout: round, paint: { "line-color": "#14161F", "line-width": 3, "line-dasharray": [1, 2.5] } });
        setReady(true);
      });
    })();

    return () => {
      disposed = true;
      clearTimeout(timeout);
      avatarRef.current?.remove();
      destRef.current?.remove();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // --- Điểm đến + vòng sóng khi còn dưới 1 km ---
  useEffect(() => {
    destRef.current?.setLngLat(ll(dest));
  }, [dest, ready]);
  useEffect(() => {
    destRef.current?.getElement().querySelector(".rm-dest")?.classList.toggle("is-near", near);
  }, [near, ready]);

  // --- Ảnh avatar và hướng ---
  useEffect(() => {
    if (avatarImgRef.current) avatarImgRef.current.src = avatarUrl || "/avatar-demo.svg";
  }, [avatarUrl, ready]);
  useEffect(() => {
    const d = avatarDirRef.current;
    if (!d) return;
    d.style.opacity = heading == null ? "0" : "1";
    if (heading != null) d.style.transform = `rotate(${heading}deg)`;
  }, [heading, ready]);

  // --- Avatar trượt mượt ~1 giây; nhảy thẳng nếu bước nhảy > 500 m ---
  const shown = useRef<LatLng | null>(null);
  useEffect(() => {
    const m = avatarRef.current;
    const map = mapRef.current;
    if (!m || !map) return;
    if (!avatarPos) {
      m.remove();
      shown.current = null;
      return;
    }
    const from = shown.current;
    if (!from || haversine(from, avatarPos) > 500) {
      shown.current = avatarPos;
      m.setLngLat(ll(avatarPos)).addTo(map);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 1000);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const p = lerpLatLng(from, avatarPos, e);
      shown.current = p;
      m.setLngLat(ll(p));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [avatarPos, ready]);

  // --- Đường đi: phần đã đi mờ, phần còn lại đậm; chỉ vẽ lại khi điểm tách tiến lên ---
  const lastSplit = useRef<{ seg: number; pt: LatLng; route: unknown } | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
    if (!route || route.points.length < 2) {
      src("remaining")?.setData(line([]));
      src("traveled")?.setData(line([]));
      lastSplit.current = null;
      return;
    }
    const pts = route.points.map(pt2ll);
    const seg = progress?.segIndex ?? 0;
    const split = progress?.splitPoint ?? pts[0];
    const prev = lastSplit.current;
    if (prev && prev.route === route && prev.seg === seg && haversine(prev.pt, split) < 50) return;
    lastSplit.current = { seg, pt: split, route };
    const traveled = progress ? [...pts.slice(0, seg + 1), split] : [];
    const remaining = progress ? [split, ...pts.slice(seg + 1)] : pts;
    src("traveled")?.setData(line(traveled.map(ll)));
    src("remaining")?.setData(line(remaining.map(ll)));
    const approx = route.approximate;
    map.setLayoutProperty("remaining", "visibility", approx ? "none" : "visible");
    map.setLayoutProperty("remaining-casing", "visibility", approx ? "none" : "visible");
    map.setLayoutProperty("remaining-approx", "visibility", approx ? "visible" : "none");
  }, [route, progress, ready]);

  // --- Lệch tuyến > 300 m: nét đứt từ avatar tới điểm gần nhất trên tuyến ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("offroute") as GeoJSONSource | undefined;
    if (avatarPos && progress && route && progress.offRouteM > OFF_ROUTE_M) {
      src?.setData(line([ll(avatarPos), ll(progress.splitPoint)]));
    } else {
      src?.setData(line([]));
    }
  }, [avatarPos, progress, route, ready]);

  // --- Khung nhìn ---
  const lastFit = useRef(0);
  const fittedStage = useRef<number | null>(null);
  useEffect(() => {
    lastFit.current = 0;
  }, [stageKey, following]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !following) return;
    const padding = { top: TOP_INSET, bottom: bottomInset + 24, left: 48, right: 48 };
    const now = Date.now();
    const fit = (points: LatLng[]) => {
      const lngs = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      const b: LngLatBoundsLike = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];
      map.fitBounds(b, { padding, maxZoom: 16, duration: 800 });
    };

    if (!avatarPos) {
      // Chưa có vị trí: bao cả tuyến và đích, một lần mỗi chặng
      if (fittedStage.current === stageKey && lastFit.current) return;
      const pts = [dest, ...(route?.points.map(pt2ll) ?? [])];
      if (pts.length > 1) fit(pts);
      else map.easeTo({ center: ll(dest), zoom: 15, duration: 800 });
      fittedStage.current = stageKey;
      lastFit.current = now;
      return;
    }

    const dist = progress?.remainingM ?? haversine(avatarPos, dest);
    const bounds = map.getBounds();
    if (dist > 3000) {
      // Còn xa: bao cả avatar và đích, chỉnh lại ~30 giây/lần hoặc khi ra khỏi khung
      const inView = bounds.contains(ll(avatarPos)) && bounds.contains(ll(dest));
      if (!inView || now - lastFit.current > 30_000) {
        fit([avatarPos, dest]);
        lastFit.current = now;
      }
    } else {
      // Đã gần: bám theo avatar ở zoom 15–17, chỉ dời khi ra khỏi vùng giữa màn hình
      const z = map.getZoom();
      if (!lastFit.current || z < 15 || z > 17) {
        map.easeTo({ center: ll(avatarPos), zoom: 16, padding, duration: 800 });
        lastFit.current = now;
      } else if (!inCentralRegion(map, avatarPos)) {
        map.easeTo({ center: ll(avatarPos), padding, duration: 800 });
      }
    }
  }, [ready, following, avatarPos, dest, route, progress, stageKey, bottomInset]);

  // MapLibre gán `position: relative` cho khung bản đồ, nên vị trí tuyệt đối đặt ở lớp ngoài
  return (
    <div className="absolute inset-0 bg-[#EAF0E6]">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

/** Vùng giữa màn hình (60% mỗi chiều, chừa thêm chỗ cho thẻ nhiệm vụ ở đáy) */
function inCentralRegion(map: MlMap, p: LatLng) {
  const b = map.getBounds();
  const latPad = (b.getNorth() - b.getSouth()) * 0.2;
  const lngPad = (b.getEast() - b.getWest()) * 0.2;
  return (
    p.lat < b.getNorth() - latPad &&
    p.lat > b.getSouth() + latPad * 1.5 &&
    p.lng < b.getEast() - lngPad &&
    p.lng > b.getWest() + lngPad
  );
}
