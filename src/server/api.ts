import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getUserId } from "./auth";
import { computeRouteOrFallback } from "@/lib/routes-api";
import { env } from "./config";
import { Game, GameError } from "./game";
import { getStore } from "./store";

const noStore = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: noStore });
}

/** Bọc mọi API cần đăng nhập: 401 khi hết phiên, lỗi thân thiện thay vì mã lỗi kỹ thuật. */
export async function withGame(fn: (game: Game, userId: string) => Promise<unknown>) {
  try {
    const userId = await getUserId();
    if (!userId) return json({ error: "unauthenticated", message: "Bạn cần đăng nhập lại." }, 401);
    const game = new Game(getStore(), {
      router: (o, d) => computeRouteOrFallback(o, d, { orsKey: env.orsApiKey }),
    });
    return json(await fn(game, userId));
  } catch (e) {
    unstable_rethrow(e); // để Next xử lý các lỗi điều khiển nội bộ (prerender, redirect…)
    if (e instanceof GameError) return json({ error: e.code, message: e.message }, 403);
    console.error("[api]", e);
    return json({ error: "server", message: "Máy chủ đang bận, thử lại sau giây lát nhé." }, 500);
  }
}

export async function readJson<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export function readPos(body: { lat?: unknown; lng?: unknown }) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (body.lat == null || body.lng == null) return null;
  return { lat, lng };
}
