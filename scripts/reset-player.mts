/**
 * Đặt lại tiến trình: xóa progress, đưa về chặng 1, chưa bắt đầu.
 *
 *   npm run player:reset -- linh          # một tài khoản
 *   npm run player:reset -- --all         # tất cả
 */
import { admin, args, emailOf, findUserByEmail } from "./_common.mjs";

const { opts, rest } = args();
const db = admin();

let players: { id: string; display_name: string }[] = [];
if (opts.all) {
  const { data, error } = await db.from("players").select("id, display_name");
  if (error) throw error;
  players = data ?? [];
} else if (rest[0]) {
  const user = await findUserByEmail(db, emailOf(rest[0]));
  if (!user) {
    console.error(`✗ Không thấy tài khoản ${rest[0]}`);
    process.exit(1);
  }
  const { data, error } = await db.from("players").select("id, display_name").eq("user_id", user.id);
  if (error) throw error;
  players = data ?? [];
} else {
  console.error("Cách dùng: npm run player:reset -- <tài khoản>   hoặc   --all");
  process.exit(1);
}

for (const p of players) {
  const d = await db.from("progress").delete().eq("player_id", p.id);
  if (d.error) throw d.error;
  const u = await db
    .from("players")
    .update({ current_stage: 1, status: "traveling", started_at: null, finished_at: null })
    .eq("id", p.id);
  if (u.error) throw u.error;
  console.log(`✓ Đã đặt lại: ${p.display_name}`);
}
if (!players.length) console.log("Không có người chơi nào.");
