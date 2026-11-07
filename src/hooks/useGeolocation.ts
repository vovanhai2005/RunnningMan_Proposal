"use client";
import { useEffect, useState } from "react";

export type Fix = {
  lat: number;
  lng: number;
  accuracy: number;
  /** m/s, có thể null */
  speed: number | null;
  /** độ, 0 = Bắc; chỉ có khi đang di chuyển */
  heading: number | null;
  at: number;
};

/**
 * - denied: người dùng tắt/từ chối quyền vị trí
 * - insecure: trang mở bằng http:// (không phải https hay localhost) — trình duyệt chặn định vị,
 *   và báo lỗi giống hệt "từ chối quyền", nên phải tách riêng để báo đúng nguyên nhân
 */
export type GeoStatus = "idle" | "waiting" | "ok" | "denied" | "insecure" | "unavailable";

/** Định vị chỉ chạy trên nguồn bảo mật (https hoặc localhost). */
export function isGeoAllowedHere() {
  return typeof window === "undefined" || window.isSecureContext;
}

/**
 * Theo dõi vị trí liên tục (watchPosition). Safari chỉ cập nhật khi màn hình sáng và tab đang mở;
 * khi tab hiện lại, ta khởi động lại watch để lấy vị trí mới ngay.
 */
export function useGeolocation(enabled: boolean) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [status, setStatus] = useState<GeoStatus>("waiting");
  const [restart, setRestart] = useState(0);

  useEffect(() => {
    if (!enabled || !("geolocation" in navigator) || !isGeoAllowedHere()) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setStatus("ok");
        setFix({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          speed: p.coords.speed,
          heading:
            p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null,
          at: p.timestamp,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus((s) => (s === "ok" ? s : "unavailable"));
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 },
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") setRestart((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      navigator.geolocation.clearWatch(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, restart]);

  const supported = typeof navigator === "undefined" || "geolocation" in navigator;
  let s: GeoStatus = status;
  if (!enabled) s = "idle";
  else if (!isGeoAllowedHere()) s = "insecure";
  else if (!supported) s = "unavailable";
  return { fix: enabled ? fix : null, status: s };
}
