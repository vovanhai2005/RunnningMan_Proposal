import { describe, expect, it } from "vitest";
import { parseMapsUrl } from "./content";
import { formatDistance, formatEta } from "./format";
import {
  cumulativeLengths,
  haversine,
  projectOnRoute,
  simplify,
  type Pt,
} from "./geo";

describe("haversine", () => {
  it("Hồ Gươm → Hồ Tây khoảng 3 km", () => {
    const d = haversine({ lat: 21.0288, lng: 105.8524 }, { lat: 21.0545, lng: 105.8371 });
    expect(d).toBeGreaterThan(3000);
    expect(d).toBeLessThan(3500);
  });
});

describe("simplify", () => {
  it("bỏ các điểm gần như thẳng hàng, giữ góc cua", () => {
    const line: Pt[] = [];
    for (let i = 0; i <= 100; i++) line.push([21 + i * 0.0001, 105 + (i % 2) * 0.00001]);
    line.push([21.01, 105.01]); // rẽ ngoặt
    const s = simplify(line, 15);
    expect(s.length).toBeLessThan(6);
    expect(s[0]).toEqual(line[0]);
    expect(s[s.length - 1]).toEqual(line[line.length - 1]);
    expect(s).toContainEqual([21.01, 105]);
  });
});

describe("projectOnRoute", () => {
  const route: Pt[] = [
    [21.0, 105.0],
    [21.01, 105.0],
    [21.01, 105.01],
  ];
  const cum = cumulativeLengths(route);
  const total = cum[cum.length - 1];

  it("ở điểm đầu thì còn nguyên quãng đường", () => {
    const p = projectOnRoute(route, cum, { lat: 21.0, lng: 105.0 })!;
    expect(p.alongRemainingM).toBeCloseTo(total, 0);
    expect(p.offRouteM).toBeLessThan(1);
  });
  it("lệch tuyến 500 m vẫn tính được quãng đường còn lại", () => {
    const p = projectOnRoute(route, cum, { lat: 21.005, lng: 104.9952 })!;
    expect(p.segIndex).toBe(0);
    expect(p.offRouteM).toBeGreaterThan(450);
    expect(p.offRouteM).toBeLessThan(550);
    expect(p.alongRemainingM).toBeCloseTo(total - cum[1] / 2, -1);
  });
  it("tới đích thì còn 0", () => {
    const p = projectOnRoute(route, cum, { lat: 21.01, lng: 105.01 })!;
    expect(p.alongRemainingM).toBeLessThan(1);
  });
});

describe("format", () => {
  it("quãng đường và thời gian tiếng Việt", () => {
    expect(formatDistance(850)).toBe("850 m");
    expect(formatDistance(12_400)).toBe("12,4 km");
    expect(formatDistance(128_000)).toBe("128 km");
    expect(formatEta(80 * 60)).toBe("khoảng 1 giờ 20 phút");
    expect(formatEta(15 * 60)).toBe("khoảng 15 phút");
    expect(formatEta(30)).toBe("dưới 1 phút");
  });
});

describe("parseMapsUrl", () => {
  it("đọc tọa độ từ nhiều dạng link", () => {
    expect(
      parseMapsUrl(
        "https://www.google.com/maps/place/H%E1%BB%93+G%C6%B0%C6%A1m/@21.0287,105.85,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d21.0287797!4d105.8524247",
      ),
    ).toEqual({ lat: 21.0287797, lng: 105.8524247 });
    expect(parseMapsUrl("https://maps.google.com/?q=21.03,105.85")).toEqual({ lat: 21.03, lng: 105.85 });
    expect(parseMapsUrl("21.0287, 105.8524")).toEqual({ lat: 21.0287, lng: 105.8524 });
    expect(parseMapsUrl("https://maps.app.goo.gl/abc")).toBeNull();
  });
});
