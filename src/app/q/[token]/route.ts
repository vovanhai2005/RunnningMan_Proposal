import type { NextRequest } from "next/server";

/**
 * Link trong mã QR: https://<tên miền>/q/<qr_token>.
 * Mở bằng app Camera của iPhone sẽ vào Safari rồi chuyển về app kèm mã cần quét;
 * app gửi mã lên server sau khi đã bấm "Bắt đầu cuộc đua".
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/q/[token]">) {
  const { token } = await ctx.params;
  const url = new URL("/", req.url);
  url.searchParams.set("scan", token.slice(0, 200));
  return Response.redirect(url, 302);
}
