import { withGame } from "@/server/api";

export async function POST() {
  return withGame((game, userId) => game.start(userId));
}
