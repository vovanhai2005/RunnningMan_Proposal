import "server-only";
import { DEFAULT_LOGIN_EMAIL_DOMAIN, usernameToEmail as toEmail } from "@/lib/username";

/**
 * Biến môi trường phía server. Chấp nhận cả tên khóa kiểu cũ (anon / service_role)
 * lẫn kiểu mới của Supabase (publishable / secret).
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "",
  supabaseServiceKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "",
  /** Khóa OpenRouteService (tùy chọn); không có thì tính đường bằng OSRM công cộng */
  orsApiKey: process.env.ORS_API_KEY ?? "",
  loginEmailDomain: process.env.LOGIN_EMAIL_DOMAIN || DEFAULT_LOGIN_EMAIL_DOMAIN,
};

/**
 * Chế độ demo: chạy hoàn toàn trong bộ nhớ, không cần Supabase.
 * Bật khi thiếu biến môi trường Supabase (hoặc đặt DEMO_MODE=1).
 * Không dùng cho ngày thật — dữ liệu mất khi server khởi động lại.
 */
export const isDemo =
  process.env.DEMO_MODE === "1" ||
  !(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceKey);

if (isDemo && process.env.VERCEL_ENV === "production") {
  console.warn("[config] ĐANG CHẠY CHẾ ĐỘ DEMO TRÊN PRODUCTION — kiểm tra biến môi trường Supabase!");
}

export function usernameToEmail(username: string): string {
  return toEmail(username, env.loginEmailDomain);
}
