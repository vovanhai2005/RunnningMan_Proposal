import { json, readJson } from "@/server/api";
import { unstable_rethrow } from "next/navigation";
import { signIn } from "@/server/auth";

export async function POST(req: Request) {
  const { username, password } = await readJson<{ username: string; password: string }>(req);
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return json({ error: "bad_request", message: "Nhập tài khoản và mật khẩu nhé." }, 400);
  }
  try {
    const ok = await signIn(username, password);
    if (!ok) {
      return json({ error: "invalid", message: "Tài khoản hoặc mật khẩu chưa đúng." }, 401);
    }
    return json({ ok: true });
  } catch (e) {
    unstable_rethrow(e);
    console.error("[login]", e);
    return json({ error: "server", message: "Không kết nối được máy chủ, thử lại nhé." }, 500);
  }
}
