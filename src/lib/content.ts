/**
 * Định dạng file nội dung `content/stages.json` (bản mẫu: `content/stages.example.json`).
 * Dùng bởi script `npm run content:push` và chế độ demo.
 */
export type StageContent = {
  order: number;
  title: string;
  /** Tọa độ điểm đến. Có thể bỏ trống nếu có `mapsUrl`. */
  lat?: number;
  lng?: number;
  /** Link Google Maps của điểm (script sẽ tự đọc tọa độ) */
  mapsUrl?: string;
  puzzle: string;
  puzzleImage?: string | null;
  /** Các cách viết được chấp nhận; so sánh không dấu, không phân biệt hoa thường */
  answers: string[];
  hints?: string[];
  successMessage: string;
};

export type ContentFile = { stages: StageContent[] };

export function validateContent(c: ContentFile): string[] {
  const errors: string[] = [];
  if (!Array.isArray(c.stages) || c.stages.length === 0) return ["Thiếu danh sách stages"];
  const orders = c.stages.map((s) => s.order).sort((a, b) => a - b);
  orders.forEach((o, i) => {
    if (o !== i + 1) errors.push(`Thứ tự chặng phải là 1..${orders.length} liên tiếp`);
  });
  for (const s of c.stages) {
    const tag = `Chặng ${s.order}`;
    if (!s.title) errors.push(`${tag}: thiếu title`);
    if ((s.lat == null || s.lng == null) && !s.mapsUrl) errors.push(`${tag}: thiếu lat/lng hoặc mapsUrl`);
    if (!s.puzzle) errors.push(`${tag}: thiếu puzzle`);
    if (!s.answers?.length) errors.push(`${tag}: thiếu answers`);
    if (!s.successMessage) errors.push(`${tag}: thiếu successMessage`);
  }
  return [...new Set(errors)];
}

/** Đọc tọa độ từ link Google Maps dạng đầy đủ (link rút gọn cần mở ra trước). */
export function parseMapsUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // vị trí chính xác của địa điểm
    /[?&](?:q|query|destination|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // tâm khung nhìn
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/, // "21.0287, 105.8524"
  ];
  const decoded = decodeURIComponent(url);
  for (const re of patterns) {
    const m = decoded.match(re);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}
