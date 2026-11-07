/**
 * Tạo trang in mã QR: mỗi chặng 2 bản, có mã chữ in dưới để nhập tay (mục 6.7).
 *   npm run qr:print   →  print/qr-print.html  (mở bằng trình duyệt rồi In, nên ép plastic)
 * Cần APP_URL trong .env.local, ví dụ https://cuoc-dua.vercel.app
 */
import fs from "node:fs";
import QRCode from "qrcode";
import { admin, need } from "./_common.mjs";

const appUrl = need("APP_URL").replace(/\/$/, "");
const db = admin();
const { data: stages, error } = await db
  .from("stages")
  .select("stage_order, title, qr_token, manual_code")
  .order("stage_order");
if (error) throw error;
if (!stages?.length) {
  console.error("✗ Chưa có chặng nào. Chạy npm run content:push trước.");
  process.exit(1);
}

const cards: string[] = [];
for (const s of stages) {
  const url = `${appUrl}/q/${s.qr_token}`;
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  for (const copy of [1, 2]) {
    cards.push(`
    <section class="card">
      <div class="top"><span class="tag">NHIỆM VỤ ${s.stage_order}</span><span class="copy">Bản ${copy}/2</span></div>
      <div class="qr">${svg}</div>
      <div class="hint">Quét bằng app Camera hoặc nút “Quét mã”</div>
      <div class="code">${s.manual_code}</div>
      <div class="hint">Không quét được? Nhập mã chữ này</div>
      <div class="helper">Dành cho người hỗ trợ: ${escapeHtml(s.title)}</div>
    </section>`);
  }
}

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Mã QR các chặng</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: system-ui, sans-serif; margin: 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .card { border: 2px dashed #999; border-radius: 6mm; padding: 6mm; text-align: center; break-inside: avoid; }
  .top { display: flex; justify-content: space-between; font-weight: 800; }
  .tag { background: #101320; color: #FFC727; padding: 1mm 3mm; border-radius: 2mm; letter-spacing: .1em; }
  .copy { color: #888; font-size: 10pt; }
  .qr svg { width: 62mm; height: 62mm; margin: 4mm auto 1mm; display: block; }
  .code { font: 800 22pt ui-monospace, monospace; letter-spacing: .12em; margin-top: 3mm; }
  .hint { color: #666; font-size: 9pt; }
  .helper { margin-top: 3mm; padding-top: 2mm; border-top: 1px solid #ddd; font-size: 8pt; color: #999; }
  .note { font-size: 10pt; color: #555; margin-bottom: 6mm; }
  @media print { .note { display: none; } }
</style></head><body>
<p class="note">${stages.length} chặng × 2 bản. In A4, cắt theo nét đứt, nên ép plastic. Link: ${appUrl}/q/…</p>
<div class="grid">${cards.join("")}</div>
</body></html>`;

fs.mkdirSync("print", { recursive: true });
fs.writeFileSync("print/qr-print.html", html);
console.log(`✓ Đã tạo print/qr-print.html (${stages.length} chặng × 2 bản).`);

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
