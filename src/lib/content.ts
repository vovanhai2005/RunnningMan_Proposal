/**
 * Định dạng file nội dung `content/stages.json` (bản mẫu: `content/stages.example.json`).
 * Dùng bởi script `npm run content:push` và chế độ demo.
 */
export type StageContent = {
  order: number;
  /** Tên địa điểm. Chặng 1: chỉ lộ sau khi quét được mã ở đó. Chặng 2+: lộ ngay khi quét mã chặng trước */
  title: string;
  /** Địa chỉ hiện cùng tên địa điểm (vd. "số 10 phố Lý Quốc Sư, Hoàn Kiếm, Hà Nội") */
  address?: string;
  /** Tọa độ điểm đến. Có thể bỏ trống nếu có `mapsUrl`. */
  lat?: number;
  lng?: number;
  /** Link Google Maps của điểm (script sẽ tự đọc tọa độ) */
  mapsUrl?: string;
  /** Gợi ý địa điểm (chỉ dùng cho chặng 1: chưa có mã QR nào dẫn tới đó) */
  clue?: string;
  clueImage?: string | null;
  /** Tên cũ của `clue` / `clueImage` (file nội dung kiểu cũ vẫn đọc được) */
  puzzle?: string;
  puzzleImage?: string | null;
  /** Không còn dùng (bỏ bước trả lời câu đố) — giữ để file cũ vẫn hợp lệ */
  answers?: string[];
  hints?: string[];
  /** Lời nhắn hiện ra khi quét được mã ở địa điểm này */
  successMessage: string;
};

export const clueOf = (s: StageContent) => s.clue ?? s.puzzle ?? "";
export const clueImageOf = (s: StageContent) => s.clueImage ?? s.puzzleImage ?? null;

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
    if (s.order === 1 && !clueOf(s)) errors.push(`${tag}: thiếu clue (gợi ý địa điểm chặng đầu)`);
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
