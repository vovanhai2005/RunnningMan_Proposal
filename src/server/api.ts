import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getUserId } from "./auth";
import { Game, GameError } from "./game";
import { getStore } from "./store";

const noStore = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: noStore });
}

/** Bọc mọi API của người chơi: lỗi thân thiện thay vì mã lỗi kỹ thuật. */
export async function withGame(fn: (game: Game, userId: string) => Promise<unknown>) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return json(
        { error: "no_player", message: "Cuộc đua chưa có người chơi. Hãy liên hệ Ban tổ chức." },
        403,
      );
    }
    const game = new Game(getStore());
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
