import { withGame } from "@/server/api";

/** Nút "Chơi lại từ đầu" trên bản đồ màn chơi */
export async function POST() {
  return withGame((game, userId) => game.reset(userId));
}
