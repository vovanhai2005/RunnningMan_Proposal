import { beforeEach, describe, expect, it } from "vitest";
import content from "../../content/stages.example.json";
import { straightRoute } from "@/lib/routes-api";
import { extractToken, Game } from "./game";
import { MemoryStore, stagesFromContent } from "./store/memory";

const START = { lat: 21.02, lng: 105.84 };

function setup() {
  const store = new MemoryStore(stagesFromContent(content));
  store.addPlayer("u1", "Linh");
  let t = new Date("2026-11-14T08:00:00Z").getTime();
  const clock = { advance: (ms: number) => (t += ms) };
  // Không gọi mạng trong kiểm thử: tính đường bằng đường thẳng
  const game = new Game(store, { now: () => new Date(t), router: async (o, d) => straightRoute(o, d) });
  return { store, game, clock };
}

describe("luồng chơi", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("chưa bắt đầu thì chưa lộ chặng nào", async () => {
    const s = await ctx.game.getState("u1");
    expect(s.status).toBe("not_started");
    expect(s.stage).toBeNull();
  });

  it("tài khoản chưa ghi danh bị từ chối", async () => {
    await expect(ctx.game.getState("lạ")).rejects.toThrow(/chưa được ghi danh/);
  });

  it("bắt đầu: chỉ lộ chặng 1, có tuyến từ vị trí hiện tại, không lộ câu đố/đáp án", async () => {
    const s = await ctx.game.start("u1", START);
    expect(s.status).toBe("traveling");
    expect(s.stage?.order).toBe(1);
    expect(s.stage?.route?.points.length).toBeGreaterThan(1);
    expect(s.stage?.route?.points[0]).toEqual([START.lat, START.lng]);
    expect(s.puzzle).toBeNull();
    const raw = JSON.stringify(s);
    expect(raw).not.toContain("demo-1");
    expect(raw).not.toContain("RM1");
    expect(raw).not.toContain("Hồ Gươm");
    expect(raw).not.toContain(content.stages[1].title);
  });

  it("bấm bắt đầu lần nữa không đổi started_at", async () => {
    const a = await ctx.game.start("u1", START);
    ctx.clock.advance(60_000);
    const b = await ctx.game.start("u1", START);
    expect(b.player.startedAt).toBe(a.player.startedAt);
  });

  it("quét mã chặng 2 khi chặng 1 chưa xong bị chặn", async () => {
    await ctx.game.start("u1", START);
    const r = await ctx.game.scan("u1", { token: "demo-2" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("Đây không phải mã của chặng này.");
    expect((await ctx.game.getState("u1")).status).toBe("traveling");
  });

  it("mã sai hoàn toàn bị từ chối", async () => {
    await ctx.game.start("u1", START);
    const r = await ctx.game.scan("u1", { token: "khong-ton-tai" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid");
  });

  it("chưa quét mã thì không trả lời được", async () => {
    await ctx.game.start("u1", START);
    const r = await ctx.game.answer("u1", "Hồ Gươm");
    expect(r.ok).toBe(false);
  });

  it("quét bằng link đầy đủ hoặc mã chữ đều được", async () => {
    await ctx.game.start("u1", START);
    const r = await ctx.game.scan("u1", { token: "https://race.vercel.app/q/demo-1" });
    expect(r.ok).toBe(true);
    const r2 = await ctx.game.scan("u1", { code: "rm 1" });
    expect(r2.ok).toBe(true);
    if (r.ok) {
      expect(r.puzzle.text).toContain("Hồ nước");
      expect(JSON.stringify(r)).not.toContain("Hoàn Kiếm\"");
      expect(r.state.status).toBe("solving");
    }
  });

  it("sai 3 lần thì hiện gợi ý; giới hạn 10 lần/phút", async () => {
    await ctx.game.start("u1", START);
    await ctx.game.scan("u1", { token: "demo-1" });
    for (let i = 1; i <= 2; i++) {
      const r = await ctx.game.answer("u1", "sai");
      expect(r.ok && !r.correct && r.puzzle.hints.length).toBe(0);
    }
    const r3 = await ctx.game.answer("u1", "sai");
    expect(r3.ok && !r3.correct && r3.newHint).toBe(true);
    expect(r3.ok && !r3.correct && r3.puzzle.hints).toEqual([content.stages[0].hints[0]]);
    for (let i = 4; i <= 10; i++) await ctx.game.answer("u1", "sai");
    const limited = await ctx.game.answer("u1", "Hồ Gươm");
    expect(limited.ok).toBe(false);
    if (!limited.ok) expect(limited.reason).toBe("rate_limited");
    ctx.clock.advance(61_000);
    const ok = await ctx.game.answer("u1", "ho guom");
    expect(ok.ok && ok.correct).toBe(true);
  });

  it("chạy trọn 4 chặng tới màn về đích", async () => {
    await ctx.game.start("u1", START);
    const answers = content.stages.map((s) => s.answers[0]);
    for (let i = 0; i < 4; i++) {
      const before = await ctx.game.getState("u1");
      expect(before.stage?.order).toBe(i + 1);
      expect(before.stage?.route).not.toBeNull();
      const scan = await ctx.game.scan("u1", { token: `demo-${i + 1}` });
      expect(scan.ok).toBe(true);
      ctx.clock.advance(10 * 60_000);
      const r = await ctx.game.answer("u1", answers[i].toUpperCase());
      expect(r.ok && r.correct).toBe(true);
      if (r.ok && r.correct) {
        expect(r.successMessage).toBe(content.stages[i].successMessage);
        expect(r.state.status).toBe(i === 3 ? "finished" : "traveling");
      }
    }
    const end = await ctx.game.getState("u1");
    expect(end.status).toBe("finished");
    expect(end.stage).toBeNull();
    expect(end.player.finishedAt).not.toBeNull();
    // Quét lại mã cũ: chỉ xem
    const again = await ctx.game.scan("u1", { token: "demo-2" });
    expect(again.ok && again.puzzle.readOnly).toBe(true);
  });

  it("mở khóa tay bằng cách sửa current_stage (như trong Table Editor)", async () => {
    await ctx.game.start("u1", START);
    ctx.store.players[0].current_stage = 3;
    const s = await ctx.game.getState("u1");
    expect(s.status).toBe("traveling");
    expect(s.stage?.order).toBe(3);
    expect((await ctx.game.scan("u1", { token: "demo-3" })).ok).toBe(true);
  });

  it("chưa có vị trí lúc bắt đầu: tuyến chặng 1 tính sau", async () => {
    const s = await ctx.game.start("u1", null);
    expect(s.stage?.route).toBeNull();
    const s2 = await ctx.game.planRoute("u1", START);
    expect(s2.stage?.route?.points.length).toBeGreaterThan(1);
  });
});

describe("extractToken", () => {
  it("đọc token từ link hoặc chuỗi trần", () => {
    expect(extractToken("https://x.vercel.app/q/abc_DEF-123")).toBe("abc_DEF-123");
    expect(extractToken("abc123")).toBe("abc123");
    expect(extractToken("không hợp lệ")).toBe("");
  });
});
