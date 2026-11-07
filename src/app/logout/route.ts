import { signOut } from "@/server/auth";

/** Đường dẫn ẩn để đổi tài khoản khi chạy thử: mở /logout trên điện thoại. */
export async function GET(req: Request) {
  await signOut();
  return Response.redirect(new URL("/", req.url), 302);
}
