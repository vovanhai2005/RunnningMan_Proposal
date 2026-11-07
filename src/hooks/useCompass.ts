"use client";
import { useEffect, useRef, useState } from "react";

/** Hướng la bàn (độ, 0 = Bắc). iOS cung cấp `webkitCompassHeading`. Giới hạn ~5 lần/giây. */
export function useCompass(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const last = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: DeviceOrientationEvent) => {
      const now = performance.now();
      if (now - last.current < 200) return;
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      let h: number | null = null;
      if (typeof ios === "number" && !Number.isNaN(ios)) h = ios;
      else if (e.absolute && e.alpha != null) h = (360 - e.alpha) % 360;
      if (h == null) return;
      last.current = now;
      setHeading((prev) => (prev != null && Math.abs(angleDiff(prev, h!)) < 4 ? prev : h));
    };
    window.addEventListener("deviceorientation", handler, true);
    window.addEventListener("deviceorientationabsolute" as "deviceorientation", handler, true);
    return () => {
      window.removeEventListener("deviceorientation", handler, true);
      window.removeEventListener("deviceorientationabsolute" as "deviceorientation", handler, true);
    };
  }, [enabled]);

  return heading;
}

export function angleDiff(a: number, b: number) {
  return ((b - a + 540) % 360) - 180;
}
