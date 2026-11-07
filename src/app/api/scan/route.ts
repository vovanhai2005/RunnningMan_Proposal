import { readJson, withGame } from "@/server/api";

export async function POST(req: Request) {
  const body = await readJson<{ token: string; code: string }>(req);
  return withGame((game, userId) =>
    game.scan(userId, {
      token: typeof body.token === "string" ? body.token.slice(0, 500) : undefined,
      code: typeof body.code === "string" ? body.code.slice(0, 100) : undefined,
    }),
  );
}
