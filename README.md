# Cuộc Đua — web app "Running Man" (Phase 1)

Web app cho người chơi chạy trên Safari iPhone (không cần đăng nhập): chào mừng → bản đồ màn chơi → mỗi màn hiện một gợi ý về địa điểm bí mật → gõ đúng tên địa điểm thì lộ điểm đến → đến trong vòng 1 km thì hiện gợi ý chỗ giấu mã QR → quét được mã là qua màn, mở gợi ý địa điểm tiếp theo → về đích ("Bạn đã hoàn thành cuộc đua").

Stack: Next.js 16 · Supabase (Auth + Postgres) · Google Maps JavaScript API + Routes API · Vercel.

---

## 1. Chạy thử ngay (chế độ demo, không cần tài khoản nào)

```bash
npm install
npm run dev            # http://localhost:3000
```

Khi thiếu biến môi trường Supabase, app tự chạy **chế độ demo**: dữ liệu nằm trong bộ nhớ, nội dung lấy từ `content/stages.example.json`, bản đồ là bản SVG đơn giản (nếu chưa có khóa Google Maps).

Mở trang là vào thẳng màn chào mừng của người chơi demo, không cần đăng nhập.

Mã chữ của các chặng demo: `RM1`, `RM2`, `RM3`, `RM4` (link QR tương ứng `/q/demo-1` … `/q/demo-4`). Nút ↺ trên bản đồ màn chơi để chơi lại từ đầu; khởi động lại server cũng đưa dữ liệu demo về ban đầu.

Giả lập vị trí khi thử trên máy tính: Chrome DevTools → ⋮ → More tools → **Sensors** → Location.

---

## 2. Cài đặt thật (việc ngày 7/11)

### 2.1 Supabase (gói Free)
1. Tạo project mới.
2. **SQL Editor** → dán toàn bộ [`supabase/schema.sql`](supabase/schema.sql) → Run. (Tạo 3 bảng `stages`, `players`, `progress`, bật RLS và bucket `avatars`.)
3. **Project Settings → API**: lấy `Project URL`, khóa `anon`/publishable và `service_role`/secret.

### 2.2 Google Cloud
1. Tạo project, gắn thẻ thanh toán (bắt buộc dù dùng trong hạn mức miễn phí), đặt **cảnh báo ngân sách 1 USD**.
2. Bật **Maps JavaScript API** và **Routes API**.
3. Tạo **2 khóa**:
   - Khóa trình duyệt → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Application restriction = *Websites*, thêm `https://<tên-app>.vercel.app/*` (và `http://localhost:3000/*` khi thử); API restriction = chỉ *Maps JavaScript API*.
   - Khóa server → `GOOGLE_ROUTES_API_KEY`: API restriction = chỉ *Routes API* (không giới hạn website vì gọi từ server).
4. **Google Maps Platform → Map management** → tạo Map ID (JavaScript, Vector) → `NEXT_PUBLIC_GOOGLE_MAP_ID`.

### 2.3 Vercel
1. Đưa repo lên GitHub (để **private**), Import vào Vercel.
2. Settings → Environment Variables: nhập các biến trong [`.env.example`](.env.example).
3. Deploy. Đặt tên app/tên miền **không** chứa "cầu hôn", "nhẫn"…
4. Mở link HTTPS trên iPhone để thử (vị trí và camera chỉ chạy trên HTTPS).

Trên máy tính: `cp .env.example .env.local` rồi điền cùng các giá trị để chạy script quản trị.

---

## 3. Nhập nội dung (hạn 10–11/11)

### 3.1 Bốn chặng
```bash
cp content/stages.example.json content/stages.json   # file thật, đã được .gitignore
```
Sửa `content/stages.json`, mỗi chặng:

| Trường | Ý nghĩa |
| --- | --- |
| `order` | 1, 2, 3, 4 |
| `title` | Tên địa điểm: lộ khi người chơi gõ đúng một trong `answers`. Màn không có `clue` (hiện là màn 3, 4) thì lộ ngay khi quét được mã của màn trước |
| `address` | Địa chỉ, hiện cùng tên địa điểm và nút chỉ đường Google Maps |
| `lat`, `lng` | Tọa độ địa điểm (Google Maps → nhấn giữ vào điểm → chạm vào tọa độ để sao chép). Dùng để biết khi vào bán kính 1 km (server đo lại trước khi lộ gợi ý mã QR) |
| `mapsUrl` | *Thay cho lat/lng*: link Google Maps, script tự đọc tọa độ |
| `clue` | Gợi ý về địa điểm, hiện ngay khi mở màn (xuống dòng bằng `\n`). Bỏ trống (xóa hẳn dòng) thì màn đó không có bước đoán |
| `clueImage` | URL ảnh gợi ý (tùy chọn) |
| `answers` | Các cách viết tên địa điểm được chấp nhận. Không phân biệt hoa thường, dấu, dấu câu; câu trả lời chứa trọn một cách viết cũng tính là đúng ("tòa T8 Times City" chứa "T8"). Có `clue` mà bỏ trống `answers` thì không có ô nhập: chỉ hiện gợi ý (không lộ tên địa điểm) |
| `qrHint` | Gợi ý chỗ giấu mã QR, hiện khi người chơi vào trong vòng 1 km quanh điểm đến (lưu ở cột `hints`) |
| `successMessage` | Lời nhắn hiện ra khi quét được mã QR bí mật ở địa điểm này |

File kiểu cũ có `puzzle` vẫn đọc được (`puzzle` được dùng làm gợi ý). Quét đúng mã QR ở bước nào cũng qua màn (dự phòng khi GPS không chạy).

```bash
npm run content:push -- --dry     # chỉ kiểm tra file
npm run content:push              # ghi lên Supabase (mã QR đã có được giữ nguyên)
```
Mã QR và mã chữ được tạo một lần và **giữ nguyên** khi đẩy lại, nên in QR xong vẫn sửa nội dung thoải mái. Giấu mã QR của mỗi chặng ở đúng địa điểm đó.

**Tên chặng** (màn mở đầu mỗi chặng, vd. "Chặng 1: Nơi tình yêu bắt đầu") sửa trong [`src/server/story.ts`](src/server/story.ts); `numbered: false` thì chỉ hiện câu, không ghi "Chặng N".

**Ảnh kỷ niệm** (hiện ngay sau khi quét được mã của chặng, xem lại được bằng nút "Xem ảnh kỷ niệm" ở màn đã qua): bỏ ảnh/video gốc vào `src/assets/stage/stage<N>/` rồi chạy
```bash
npm run memories:build   # cần ffmpeg; xuất bản nhẹ ra public/memories/ + src/server/memories.generated.json
```
Ảnh được thu nhỏ, xoay đúng chiều và xóa EXIF (có vị trí GPS); video iPhone (HEVC/HDR) được chuyển sang H.264 để phát trên mọi máy. Thứ tự hiển thị theo tên file gốc. Nhớ commit `public/memories/` và file `.generated.json` để Vercel có ảnh; file gốc không cần lên server.

### 3.2 Tài khoản người chơi
```bash
npm run player:create -- --username linh --password "mat-khau" --name "Linh" --avatar ./avatar.webp
npm run player:create -- --username thu  --password "thu123"   --name "Người thử"
```
Ảnh avatar: vuông, rõ mặt, nên xuất 144×144 px WebP dưới 20 KB. Tài khoản `linh` tương ứng email `linh@players.race` trong Supabase Auth (đổi đuôi bằng `LOGIN_EMAIL_DOMAIN`).

**App không có đăng nhập**: mật khẩu ở trên chỉ để tạo tài khoản trong Supabase Auth, người chơi không bao giờ phải gõ. App luôn chơi bằng **người chơi tạo sớm nhất** trong bảng `players`. Có nhiều người chơi thì đặt biến môi trường `PLAYER_ID` = cột `id` của người cần chơi (trên Vercel: Settings → Environment Variables, rồi deploy lại).

### 3.3 In mã QR
```bash
npm run qr:print       # → print/qr-print.html, mở bằng trình duyệt → In
```
Mỗi chặng 2 bản, có mã chữ (dạng `RM-XXXX`) in dưới QR để nhập tay khi camera không quét được. Link trong QR có dạng `https://<app>/q/<token-ngẫu-nhiên>` — quét bằng nút "Quét mã" hay app Camera của iPhone đều được.

---

## 4. Vận hành

| Việc | Cách làm |
| --- | --- |
| Xem tiến trình | `npm run status -- --watch` (cập nhật 15 giây/lần) |
| Mở khóa tay một chặng | Supabase → Table Editor → `players` → sửa `current_stage` (vd 2 → 3). App tự hiểu, không cần sửa gì khác |
| Đặt lại sau khi chạy thử | `npm run player:reset -- linh` (hoặc `--all`), hoặc chạy [`supabase/reset.sql`](supabase/reset.sql) |
| Sửa nội dung | Sửa `content/stages.json` → `npm run content:push`, hoặc sửa thẳng trong Table Editor |
| Chơi lại từ đầu | Nút ↺ góc trên bên phải bản đồ màn chơi (có bảng xác nhận) |
| Đổi người chơi | Đặt `PLAYER_ID` trên Vercel rồi deploy lại |

### Danh sách ngày 13–14/11
- [ ] `npm run player:reset -- --all`
- [ ] Chạy thử trên điện thoại khác (mở link, quét thử), rồi bấm ↺ hoặc `npm run player:reset -- --all` để đặt lại lần nữa
- [ ] 4 người hỗ trợ cầm QR (kèm bản dự phòng), biết vị trí và giờ có mặt
- [ ] Giá đỡ + sạc trên xe
- [ ] Biến môi trường trên Vercel **không** ở chế độ demo (log Vercel sẽ cảnh báo nếu đang demo)

---

## 5. Ứng xử trên iPhone (đã xử lý trong code)

- **Bắt đầu cuộc đua**: cú chạm này xin quyền vị trí + la bàn, mở khóa âm thanh, bật giữ màn hình sáng (Wake Lock). Mở lại trang giữa chừng thì cú chạm đầu tiên làm lại việc này.
- **Màn hình tắt / đóng tab**: tiến trình nằm trên server; mở lại là vào đúng chặng, avatar nhảy thẳng tới vị trí mới.
- **Từ chối vị trí**: vẫn chơi được (bản đồ có điểm đến + đường đi, xác nhận bằng QR); có thẻ hướng dẫn bật lại.
- **Mất sóng**: báo trên bản đồ, tự tải lại trạng thái khi có mạng.
- **Google Maps lỗi** (sai khóa, hết hạn mức…): tự chuyển sang bản đồ SVG dự phòng.
- **Routes API lỗi**: dùng đường thẳng ước lượng (vẽ nét chấm, ghi "Đường ước lượng").
- Chữ ô nhập ≥ 16 px (không tự phóng to), tắt tự viết hoa/tự sửa; `viewport-fit=cover` + safe-area cho Dynamic Island; `overscroll-behavior: none`.

## 6. Bảo mật & giữ bí mật

- Trình duyệt chỉ nhận **chặng hiện tại** (tên, tọa độ, đường đi). Câu đố chỉ gửi sau khi quét đúng mã; đáp án, `qr_token`, chặng sau không bao giờ rời server.
- Bảng `stages` bật RLS và không có policy ⇒ chỉ khóa service role (trên server) đọc được. Trình duyệt không gọi Supabase trực tiếp.
- `qr_token` là chuỗi ngẫu nhiên 24 ký tự, không đoán được. Trả lời bị giới hạn 10 lần/phút.
- **Không có đăng nhập**: ai có link app cũng xem được và chơi thay người chơi (kể cả bấm ↺ xóa tiến độ, hay quét mã QR bí mật nếu tìm thấy). Chỉ gửi link cho người chơi, giấu kỹ mã QR.
- Tiêu đề trang mặc định "Cuộc Đua Bí Mật", có `noindex`. File kế hoạch PDF ở thư mục gốc không được deploy, nhưng **đừng đưa repo lên GitHub ở chế độ public**.

## 7. Phát triển

```bash
npm test            # kiểm thử logic: chuẩn hóa đáp án, hình học tuyến đường, luồng 4 chặng
npm run typecheck
npm run lint
npm run build
```

```
src/
  app/                 trang duy nhất (/), API (/api/*), link QR (/q/[token])
  components/          màn hình: Welcome, GameMap (bản đồ màn chơi + các bảng), Scan, Success, Review
  hooks/               useGeolocation (theo dõi vị trí để báo khi vào bán kính 1 km)
  lib/                 chuẩn hóa đáp án, hình học (Douglas–Peucker, chiếu lên tuyến), Routes API
  server/              logic game (game.ts), chọn người chơi (auth.ts), store Supabase / bộ nhớ
scripts/               content:push, player:create, player:reset, qr:print, status
supabase/              schema.sql, reset.sql
content/               stages.example.json (mẫu); stages.json (nội dung thật, không commit)
```

Phase 2 (chưa làm): màn quản trò `/admin` với Supabase Realtime.
