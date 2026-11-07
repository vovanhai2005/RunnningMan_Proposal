import { withGame } from "@/server/api";

export async function GET() {
  return withGame((game, userId) => game.getState(userId));
}
