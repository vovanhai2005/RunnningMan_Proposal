/**
 * Ảnh kỷ niệm theo chặng: đọc ảnh/video gốc trong `src/assets/stage/stage<N>/`,
 * xuất bản nhẹ cho điện thoại ra `public/memories/` và ghi danh sách vào
 * `src/server/memories.generated.json` (server chỉ gửi danh sách của chặng đã qua).
 *
 * - Ảnh: cạnh dài tối đa 1600px, xoay đúng chiều, xóa EXIF (có cả vị trí GPS) + ảnh nhỏ 320px.
 * - Video: H.264 cạnh dài 1280px, chuyển HDR (HLG/PQ của iPhone) sang màu thường, phát được
 *   trên mọi trình duyệt; kèm ảnh bìa.
 * - Tên file là mã băm nội dung nên không đoán được đường dẫn ảnh của chặng chưa mở.
 * - Thứ tự hiển thị theo tên file gốc: muốn đổi thứ tự thì đổi tên (vd. thêm 01-, 02- ở đầu).
 *
 * Cần ffmpeg + ffprobe trên máy. Chạy lại mỗi khi thêm/bớt ảnh: `npm run memories:build`
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = "src/assets/stage";
const OUT = "public/memories";
const MANIFEST = "src/server/memories.generated.json";
/** Đổi khi đổi thông số nén để buộc xuất lại toàn bộ */
const RECIPE = "v1";
const PHOTO_MAX = 1600;
const THUMB_MAX = 320;
const VIDEO_MAX = 1280;
const PHOTO = /\.(jpe?g|png|webp)$/i;
const VIDEO = /\.(mp4|mov|m4v)$/i;

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

function probe(file, entries) {
  return run("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", `stream=${entries}`, "-of", "default=nw=1", file,
  ])
    .split("\n")
    .reduce((acc, line) => {
      const [k, v] = line.split("=");
      if (k) acc[k] = v;
      return acc;
    }, {});
}

function size(file) {
  const s = probe(file, "width,height");
  return { width: Number(s.width), height: Number(s.height) };
}

/** Thu nhỏ để cạnh dài không vượt `max`, giữ tỉ lệ, kích thước chẵn */
const fit = (max) =>
  `scale=w='min(${max},iw)':h='min(${max},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`;

function ffmpeg(args) {
  run("ffmpeg", ["-v", "error", "-y", ...args]);
}

try {
  run("ffmpeg", ["-version"]);
} catch {
  console.error("Không tìm thấy ffmpeg. Cài trước: sudo apt install ffmpeg (hoặc brew install ffmpeg).");
  process.exit(1);
}

if (!existsSync(SRC)) {
  console.error(`Không có thư mục ${SRC}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const manifest = {};
const keep = new Set();

const stageDirs = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^stage\d+$/i.test(d.name))
  .sort((a, b) => parseInt(a.name.slice(5)) - parseInt(b.name.slice(5)));

for (const dir of stageDirs) {
  const order = parseInt(dir.name.slice(5), 10);
  const files = readdirSync(path.join(SRC, dir.name))
    .filter((f) => PHOTO.test(f) || VIDEO.test(f))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const items = [];

  for (const name of files) {
    const src = path.join(SRC, dir.name, name);
    const hash = createHash("sha256")
      .update(RECIPE)
      .update(readFileSync(src))
      .digest("hex")
      .slice(0, 20);
    const isVideo = VIDEO.test(name);
    const main = path.join(OUT, `${hash}.${isVideo ? "mp4" : "jpg"}`);
    const thumb = path.join(OUT, `${hash}.thumb.jpg`);
    const poster = path.join(OUT, `${hash}.poster.jpg`);

    if (!existsSync(main)) {
      process.stdout.write(`  chặng ${order}: ${name} … `);
      if (isVideo) {
        const { color_transfer } = probe(src, "color_transfer");
        const hdr = color_transfer === "arib-std-b67" || color_transfer === "smpte2084";
        // HDR → SDR: tuyến tính hóa, đổi gam màu BT.2020 → BT.709, nén dải sáng (hable)
        const tonemap = hdr
          ? "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,"
          : "";
        ffmpeg([
          "-i", src,
          "-map", "0:v:0", "-map", "0:a:0?",
          "-vf", `${tonemap}${fit(VIDEO_MAX)},format=yuv420p`,
          "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "24",
          "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
          "-c:a", "aac", "-b:a", "96k",
          "-map_metadata", "-1", "-movflags", "+faststart",
          main,
        ]);
        ffmpeg(["-ss", "0.3", "-i", main, "-frames:v", "1", "-q:v", "3", poster]);
      } else {
        // ffmpeg tự xoay theo EXIF; ảnh xuất ra không mang EXIF (không lộ vị trí GPS)
        ffmpeg(["-i", src, "-vf", fit(PHOTO_MAX), "-q:v", "4", "-map_metadata", "-1", main]);
      }
      ffmpeg(["-i", isVideo ? poster : main, "-vf", fit(THUMB_MAX), "-q:v", "5", thumb]);
      console.log("xong");
    }

    keep.add(path.basename(main));
    keep.add(path.basename(thumb));
    if (isVideo) keep.add(path.basename(poster));
    const url = (f) => `/memories/${path.basename(f)}`;
    items.push({
      kind: isVideo ? "video" : "photo",
      src: url(main),
      thumb: url(thumb),
      poster: isVideo ? url(poster) : null,
      ...size(main),
    });
  }
  if (items.length) manifest[order] = items;
}

// Dọn file của ảnh đã bị xóa/thay
for (const f of readdirSync(OUT)) {
  if (!keep.has(f)) rmSync(path.join(OUT, f));
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
const summary = Object.entries(manifest)
  .map(([o, list]) => `chặng ${o}: ${list.length}`)
  .join(", ");
console.log(`Đã ghi ${MANIFEST} (${summary || "không có ảnh"}).`);
