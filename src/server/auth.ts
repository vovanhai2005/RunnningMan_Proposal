import "server-only";
import { env } from "./config";
import { getStore } from "./store";

/**
 * Không có đăng nhập: mọi request đều chơi bằng một người chơi duy nhất
 * (PLAYER_ID nếu có, không thì người chơi tạo sớm nhất). Trả về null khi chưa tạo người chơi nào.
 */
export async function getUserId(): Promise<string | null> {
  const player = await getStore().findPlayer(env.playerId || undefined);
  return player?.user_id ?? null;
}
