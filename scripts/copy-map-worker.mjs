// MapLibre v6 tải worker riêng; sau khi đóng gói, đường dẫn mặc định không còn đúng.
// Chép worker vào public/vendor để app trỏ tới (xem MapLibreMapView). Chạy tự động sau npm install và trước build.
import fs from "node:fs";
const src = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
if (!fs.existsSync(src)) process.exit(0);

fs.mkdirSync("public/vendor", { recursive: true });
fs.copyFileSync(src, "public/vendor/maplibre-gl-worker.mjs");
console.log("maplibre worker → public/vendor/");
