import { readJson, withGame } from "@/server/api";

export async function POST(req: Request) {
  const body = await readJson<{ answer: string }>(req);
  const answer = typeof body.answer === "string" ? body.answer.slice(0, 200) : "";
  return withGame((game, userId) => game.answer(userId, answer));
}
