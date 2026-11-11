import "server-only";

/**
 * Biến môi trường phía server. Chấp nhận cả tên khóa kiểu cũ (service_role)
 * lẫn kiểu mới của Supabase (secret).
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
  supabaseServiceKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "",
  /** Khóa OpenRouteService (tùy chọn); không có thì tính đường bằng OSRM công cộng */
  orsApiKey: process.env.ORS_API_KEY ?? "",
  /**
   * Không có đăng nhập: app luôn chơi bằng một người chơi. Để trống thì lấy người chơi tạo sớm
   * nhất trong bảng `players`; có nhiều người chơi thì đặt id (cột `players.id`) của người cần chơi.
   */
  playerId: process.env.PLAYER_ID ?? "",
};

/**
 * Chế độ demo: chạy hoàn toàn trong bộ nhớ, không cần Supabase.
 * Bật khi thiếu biến môi trường Supabase (hoặc đặt DEMO_MODE=1).
 * Không dùng cho ngày thật — dữ liệu mất khi server khởi động lại.
 */
export const isDemo =
  process.env.DEMO_MODE === "1" ||
  !(env.supabaseUrl && env.supabaseServiceKey);

if (isDemo && process.env.VERCEL_ENV === "production") {
  console.warn("[config] ĐANG CHẠY CHẾ ĐỘ DEMO TRÊN PRODUCTION — kiểm tra biến môi trường Supabase!");
}
