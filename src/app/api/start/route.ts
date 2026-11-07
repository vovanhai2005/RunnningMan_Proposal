import { readJson, readPos, withGame } from "@/server/api";

export async function POST(req: Request) {
  const body = await readJson<{ lat: number; lng: number }>(req);
  return withGame((game, userId) => game.start(userId, readPos(body)));
}
