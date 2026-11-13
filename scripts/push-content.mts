/**
 * Đẩy nội dung từ content/stages.json lên Supabase.
 *
 *   npm run content:push              # đẩy nội dung
 *   npm run content:push -- --dry     # chỉ kiểm tra file, không ghi gì
 *   npm run content:push -- --file content/stages.example.json
 *
 * Mã QR (qr_token) và mã chữ đã có được GIỮ NGUYÊN theo thứ tự chặng, nên in QR rồi
 * vẫn sửa nội dung thoải mái. Muốn tạo mã mới cho một chặng: xóa dòng đó trong Table Editor.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  clueImageOf,
  clueOf,
  parseMapsUrl,
  qrHintsOf,
  validateContent,
  type ContentFile,
} from "../src/lib/content";
import { admin, args } from "./_common.mjs";

const { opts } = args();
const file = path.resolve(String(opts.file ?? "content/stages.json"));
if (!fs.existsSync(file)) {
  console.error(
    `✗ Không thấy ${file}.\n  Sao chép mẫu: cp content/stages.example.json content/stages.json`,
  );
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

/** Lỗi mạng / Supabase chưa phản hồi (vd. 522 khi project vừa thức dậy) — đáng thử lại */
const isTransient = (m: string) =>
  /fetch failed|timed? ?out|ETIMEDOUT|ECONN|ENOTFOUND|EAI_AGAIN|\b52\d\b|<!DOCTYPE/i.test(m);
/** Bỏ trang HTML lỗi của Cloudflare, chỉ giữ dòng tiêu đề */
const shortMessage = (m: string) =>
  m.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? m.slice(0, 200);

async function withRetry<T extends { error: { message: string } | null }>(
  label: string,
  run: () => PromiseLike<T>,
): Promise<T> {
  const TRIES = 4;
  for (let i = 1; ; i++) {
    const res = await run();
    if (!res.error || i >= TRIES || !isTransient(res.error.message)) return res;
    console.log(
      `  Supabase chưa phản hồi khi ${label} (${shortMessage(res.error.message)}). Thử lại ${i + 1}/${TRIES} sau 5 giây…`,
    );
    await new Promise((r) => setTimeout(r, 5000));
  }
}

function fail(what: string, message: string): never {
  if (isTransient(message)) {
    console.error(`✗ Không kết nối được Supabase khi ${what}: ${shortMessage(message)}`);
    console.error(
      "  Kiểm tra mạng, hoặc mở Supabase Dashboard xem project có đang Paused không, rồi chạy lại.",
    );
  } else {
    console.error(`✗ Lỗi khi ${what}: ${shortMessage(message)}`);
    if (/relation|does not exist|column/i.test(message)) {
      console.error(
        "  Có thể chưa chạy supabase/schema.sql (hoặc thiếu cột mới) trong SQL Editor.",
      );
    }
  }
  process.exit(1);
}

const db = admin();
const { data: existing, error } = await withRetry("đọc bảng stages", () =>
  db.from("stages").select("stage_order, qr_token, manual_code"),
);
if (error) fail("đọc bảng stages", error.message);
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

const rows: Record<string, unknown>[] = [];
for (const s of stages) {
  const prev = byOrder.get(s.order);
  const row: Record<string, unknown> = {
    stage_order: s.order,
    title: s.title,
    address: s.address ?? "",
    lat: s.lat,
    lng: s.lng,
    qr_token: prev?.qr_token ?? randomBytes(18).toString("base64url"),
    manual_code: prev?.manual_code ?? newManualCode(),
    puzzle_text: clueOf(s), // cột cũ, giờ chứa gợi ý địa điểm
    puzzle_image_url: clueImageOf(s),
    answers: s.answers ?? [],
    hints: qrHintsOf(s), // gợi ý chỗ giấu mã QR
    success_message: s.successMessage,
    updated_at: new Date().toISOString(),
  };
  rows.push(row);
}

const up = await withRetry("ghi bảng stages", () =>
  db.from("stages").upsert(rows, { onConflict: "stage_order" }),
);
if (up.error) fail("ghi bảng stages", up.error.message);
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
