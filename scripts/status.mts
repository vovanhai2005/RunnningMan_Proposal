/**
 * Xem nhanh tiến trình mọi người chơi (thay cho màn quản trò ở phase 2).
 *   npm run status            # một lần
 *   npm run status -- --watch # cập nhật mỗi 15 giây
 */
import { admin, args } from "./_common.mjs";

const { opts } = args();
const db = admin();
const t = (s: string | null) =>
  s ? new Date(s).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";

async function show() {
  const [{ data: stages }, { data: players }, { data: progress }] = await Promise.all([
    db.from("stages").select("id, stage_order, title").order("stage_order"),
    db.from("players").select("*"),
    db.from("progress").select("*"),
  ]);
  if (opts.watch) console.clear();
  console.log(`Cập nhật lúc ${t(new Date().toISOString())}\n`);
  for (const p of players ?? []) {
    const total = stages?.length ?? 0;
    const state = p.current_stage > total ? "🏁 ĐÃ VỀ ĐÍCH" : `Chặng ${p.current_stage}/${total} · ${p.status}`;
    console.log(`${p.display_name}: ${p.started_at ? state : "chưa bắt đầu"}  (bắt đầu ${t(p.started_at)}, về đích ${t(p.finished_at)})`);
    for (const s of stages ?? []) {
      const pr = (progress ?? []).find((x) => x.player_id === p.id && x.stage_id === s.id);
      console.log(
        `   ${s.stage_order}. ${s.title.padEnd(28)} quét ${t(pr?.scanned_at ?? null)}  giải ${t(pr?.solved_at ?? null)}  sai ${pr?.wrong_attempts ?? 0}  gợi ý ${pr?.hints_shown ?? 0}`,
      );
    }
    console.log();
  }
}

await show();
if (opts.watch) setInterval(show, 15000);
