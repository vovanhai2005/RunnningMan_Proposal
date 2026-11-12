import { json, readJson, withGame } from "@/server/api";

export async function POST(req: Request) {
  const body = await readJson<{ lat: number; lng: number }>(req);
  const { lat, lng } = body;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return json({ error: "bad_request", message: "Thiếu vị trí." }, 400);
  }
  return withGame((game, userId) => game.arrive(userId, { lat, lng }));
}
