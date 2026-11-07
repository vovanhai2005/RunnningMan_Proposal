import { json, readJson, readPos, withGame } from "@/server/api";

/** Tính tuyến chặng 1 khi lúc bấm "Bắt đầu" chưa có vị trí. */
export async function POST(req: Request) {
  const pos = readPos(await readJson<{ lat: number; lng: number }>(req));
  if (!pos) return json({ error: "bad_request", message: "Thiếu vị trí." }, 400);
  return withGame((game, userId) => game.planRoute(userId, pos));
}
