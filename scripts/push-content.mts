/**
 * Đẩy nội dung từ content/stages.json lên Supabase và tính sẵn đường lái xe cho chặng 2..N
 * (OpenRouteService nếu có ORS_API_KEY, không thì OSRM công cộng).
 *
 *   npm run content:push              # đẩy nội dung + tính đường
 *   npm run content:push -- --dry     # chỉ kiểm tra file, không ghi gì
 *   npm run content:push -- --file content/stages.example.json
 *
 * Mã QR (qr_token) và mã chữ đã có được GIỮ NGUYÊN theo thứ tự chặng, nên in QR rồi
 * vẫn sửa nội dung thoải mái. Muốn tạo mã mới cho một chặng: xóa dòng đó trong Table Editor.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { clueImageOf, clueOf, parseMapsUrl, validateContent, type ContentFile } from "../src/lib/content";
import { computeDriveRoute } from "../src/lib/routes-api";
import { admin, args } from "./_common.mjs";

const { opts } = args();
const file = path.resolve(String(opts.file ?? "content/stages.json"));
if (!fs.existsSync(file)) {
  console.error(`✗ Không thấy ${file}.\n  Sao chép mẫu: cp content/stages.example.json content/stages.json`);
  process.exit(1);
}
const content = JSON.parse(fs.readFileSync(file, "utf8")) as ContentFile;

/** Mở link rút gọn (maps.app.goo.gl) để lấy link đầy đủ có tọa độ */
async function resolveMapsUrl(url: string) {
  let current = url;
  for (let i = 0; i < 6; i++) {
    const p = parseMapsUrl(current);
    if (p) return p;
    const res = await fetch(current, { redirect: "manual" });
    const loc = res.headers.get("location");
    if (!loc) {
      // Một số trang trả về HTML có link đầy đủ bên trong
      const html = await res.text();
      const m = html.match(/https:\/\/www\.google\.[^"' ]+\/maps\/[^"' ]+/);
      return m ? parseMapsUrl(m[0]) : null;
    }
    current = new URL(loc, current).toString();
  }
  return null;
}

for (const s of content.stages) {
  if ((s.lat == null || s.lng == null) && s.mapsUrl) {
    const p = await resolveMapsUrl(s.mapsUrl);
    if (!p) {
      console.error(`✗ Chặng ${s.order}: không đọc được tọa độ từ link ${s.mapsUrl}.`);
      console.error(`  Mở Google Maps, nhấn giữ vào điểm, sao chép tọa độ rồi điền "lat"/"lng".`);
      process.exit(1);
    }
    Object.assign(s, p);
    console.log(`  Chặng ${s.order}: tọa độ từ link = ${p.lat}, ${p.lng}`);
  }
}

const errors = validateContent(content);
if (errors.length) {
  console.error("✗ File nội dung có lỗi:\n  - " + errors.join("\n  - "));
  process.exit(1);
}
const stages = [...content.stages].sort((a, b) => a.order - b.order);
console.log(`✓ ${stages.length} chặng hợp lệ trong ${path.relative(process.cwd(), file)}`);
if (opts.dry) process.exit(0);

const db = admin();
const { data: existing, error } = await db.from("stages").select("stage_order, qr_token, manual_code");
if (error) {
  console.error("✗ Không đọc được bảng stages. Đã chạy supabase/schema.sql chưa?\n ", error.message);
  process.exit(1);
}
const byOrder = new Map((existing ?? []).map((r) => [r.stage_order as number, r]));
const usedCodes = new Set((existing ?? []).map((r) => r.manual_code as string));

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ 0/O, 1/I dễ nhầm
function newManualCode() {
  for (;;) {
    const bytes = randomBytes(4);
    const code = "RM-" + [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
}

const orsKey = process.env.ORS_API_KEY || undefined;
console.log(orsKey ? "  Tính đường bằng OpenRouteService (dự phòng: OSRM)" : "  Tính đường bằng OSRM công cộng (chưa có ORS_API_KEY)");

const rows = [];
for (const s of stages) {
  const prev = byOrder.get(s.order);
  const row: Record<string, unknown> = {
    stage_order: s.order,
    title: s.title,
    lat: s.lat,
    lng: s.lng,
    qr_token: prev?.qr_token ?? randomBytes(18).toString("base64url"),
    manual_code: prev?.manual_code ?? newManualCode(),
    puzzle_text: clueOf(s), // cột cũ, giờ chứa gợi ý địa điểm
    puzzle_image_url: clueImageOf(s),
    answers: s.answers ?? [],
    hints: s.hints ?? [],
    success_message: s.successMessage,
    updated_at: new Date().toISOString(),
    // Mọi dòng phải có đủ cột khi upsert hàng loạt. Đường chặng 1 lưu theo người chơi (bảng progress).
    route_polyline: null,
    route_distance_m: null,
    route_duration_s: null,
    route_approximate: false,
  };
  // Chặng 2..N: đường từ điểm chặng trước. Chặng 1 tính lúc người chơi bấm "Bắt đầu".
  if (s.order > 1) {
    const from = stages.find((x) => x.order === s.order - 1)!;
    try {
      const r = await computeDriveRoute(
        { lat: from.lat!, lng: from.lng! },
        { lat: s.lat!, lng: s.lng! },
        { orsKey, timeoutMs: 20000 },
      );
      Object.assign(row, {
        route_polyline: r.points,
        route_distance_m: r.distanceM,
        route_duration_s: r.durationS,
        route_approximate: false,
      });
      console.log(
        `  Đường ${s.order - 1}→${s.order}: ${(r.distanceM / 1000).toFixed(1)} km, ~${Math.round(r.durationS / 60)} phút, ${r.points.length} điểm (${r.source})`,
      );
    } catch (e) {
      console.error(`✗ Không tính được đường tới chặng ${s.order}:`, (e as Error).message);
      console.error("  Thử lại sau ít phút, hoặc thêm ORS_API_KEY (miễn phí tại openrouteservice.org).");
      process.exit(1);
    }
  }
  rows.push(row);
}

const up = await db.from("stages").upsert(rows, { onConflict: "stage_order" });
if (up.error) {
  console.error("✗ Ghi bảng stages thất bại:", up.error.message);
  process.exit(1);
}
const extra = (existing ?? []).filter((r) => (r.stage_order as number) > stages.length);
if (extra.length) {
  const del = await db.from("stages").delete().gt("stage_order", stages.length);
  if (del.error) console.error("! Không xóa được chặng thừa:", del.error.message);
  console.log(`  Đã xóa ${extra.length} chặng thừa (thứ tự > ${stages.length}).`);
}

const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
console.log("\n✓ Đã lưu. Mã của từng chặng:");
for (const r of rows) {
  console.log(
    `  ${r.stage_order}. ${r.title}\n     mã chữ: ${r.manual_code}\n     link QR: ${appUrl || "<APP_URL>"}/q/${r.qr_token}`,
  );
}
console.log("\nIn mã QR: npm run qr:print");
