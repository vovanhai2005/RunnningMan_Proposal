/**
 * Tạo (hoặc cập nhật) tài khoản người chơi và dòng players tương ứng.
 *
 *   npm run player:create -- --username linh --password "matkhau" --name "Linh" --avatar ./linh.webp
 *
 * --avatar có thể là đường dẫn file (tải lên Supabase Storage) hoặc một URL.
 * Ảnh nên vuông 144×144 px, WebP dưới 20 KB (mục 6b).
 */
import fs from "node:fs";
import path from "node:path";
import { admin, args, emailOf, findUserByEmail } from "./_common.mjs";

const { opts } = args();
const username = opts.username as string | undefined;
const password = opts.password as string | undefined;
const name = (opts.name as string | undefined) ?? username;
if (!username || !password) {
  console.error('Cách dùng: npm run player:create -- --username linh --password "..." --name "Linh" [--avatar file|url]');
  process.exit(1);
}
if (password.length < 6) {
  console.error("✗ Mật khẩu cần ít nhất 6 ký tự (yêu cầu của Supabase).");
  process.exit(1);
}

const db = admin();
const email = emailOf(username);
let user = await findUserByEmail(db, email);
if (user) {
  const { error } = await db.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
  console.log(`✓ Đã cập nhật mật khẩu cho ${username} (${email})`);
} else {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error(`✗ Không tạo được tài khoản ${email}: ${error.message}`);
    console.error("  Nếu lỗi do email không hợp lệ, đặt LOGIN_EMAIL_DOMAIN (vd: example.com) trong .env.local và trên Vercel.");
    process.exit(1);
  }
  user = data.user;
  console.log(`✓ Đã tạo tài khoản ${username} (${email})`);
}

let avatarUrl: string | null | undefined;
const avatar = opts.avatar as string | undefined;
if (avatar) {
  if (/^https?:\/\//.test(avatar)) avatarUrl = avatar;
  else {
    const buf = fs.readFileSync(avatar);
    const ext = path.extname(avatar).slice(1).toLowerCase() || "webp";
    const type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml" }[ext] ?? "application/octet-stream";
    const key = `${user!.id}-${Date.now()}.${ext}`;
    const up = await db.storage.from("avatars").upload(key, buf, { contentType: type, upsert: true, cacheControl: "31536000" });
    if (up.error) {
      console.error("✗ Tải ảnh avatar thất bại:", up.error.message);
      process.exit(1);
    }
    avatarUrl = db.storage.from("avatars").getPublicUrl(key).data.publicUrl;
    if (buf.length > 40_000) console.warn(`! Ảnh nặng ${Math.round(buf.length / 1024)} KB — nên dưới 20 KB.`);
  }
  console.log(`✓ Avatar: ${avatarUrl}`);
}

const row: Record<string, unknown> = { user_id: user!.id, display_name: name };
if (avatarUrl !== undefined) row.avatar_url = avatarUrl;
const { error } = await db.from("players").upsert(row, { onConflict: "user_id" });
if (error) {
  console.error("✗ Ghi bảng players thất bại:", error.message);
  process.exit(1);
}
console.log(`✓ Người chơi "${name}" sẵn sàng. Đăng nhập bằng tài khoản: ${username}`);
