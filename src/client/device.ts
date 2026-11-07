"use client";

/** Giữ màn hình luôn sáng (Safari iOS 16.4+). Gọi lại mỗi lần tab hiện lại. */
let lock: WakeLockSentinel | null = null;
export async function requestWakeLock() {
  try {
    if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    if (lock && !lock.released) return;
    lock = await navigator.wakeLock.request("screen");
  } catch {
    /* chế độ nguồn điện thấp có thể từ chối — bỏ qua */
  }
}

type OrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/** iOS yêu cầu xin quyền la bàn trong một cú chạm. */
export async function requestCompassPermission(): Promise<boolean> {
  try {
    const DOE = window.DeviceOrientationEvent as OrientationEventCtor | undefined;
    if (!DOE) return false;
    if (typeof DOE.requestPermission === "function") {
      return (await DOE.requestPermission()) === "granted";
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Lấy vị trí một lần ngay trong cú chạm "Bắt đầu cuộc đua".
 * Safari iOS yêu cầu cấp quyền geolocation trong một user gesture; lệnh này
 * chỉ mở prompt — người dùng không cần chờ kết quả (tuyến chặng 1 tính khi có fix).
 */
export function requestGeolocation() {
  // Trang http:// (không bảo mật): trình duyệt luôn từ chối, không cần hỏi
  if (!("geolocation" in navigator) || !window.isSecureContext) return;
  navigator.geolocation.getCurrentPosition(
    () => {},
    () => {},
    { enableHighAccuracy: true, maximumAge: 30000 },
  );
}

export async function celebrate() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    const colors = ["#F0468A", "#FFB3D0", "#FFD84D", "#6F7CF7", "#ffffff"];
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors, disableForReducedMotion: true });
    setTimeout(
      () => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors }),
      250,
    );
    setTimeout(
      () => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors }),
      400,
    );
  } catch {
    /* bỏ qua */
  }
}
