import { withGame } from "@/server/api";

/** Nghỉ xong ở trạm nghỉ: mở chặng tiếp theo */
export async function POST() {
  return withGame((game, userId) => game.finishRest(userId));
}
