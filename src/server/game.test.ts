import { beforeEach, describe, expect, it } from "vitest";
import content from "../../content/stages.example.json";
import { extractToken, Game } from "./game";
import { MemoryStore, stagesFromContent } from "./store/memory";

function setup() {
  const store = new MemoryStore(stagesFromContent(content));
  store.addPlayer("u1", "Linh");
  let t = new Date("2026-11-14T08:00:00Z").getTime();
  const clock = { advance: (ms: number) => (t += ms) };
  const game = new Game(store, { now: () => new Date(t) });
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

  it("bắt đầu: chỉ lộ gợi ý chặng 1, không lộ tên địa điểm, mã QR hay chặng sau", async () => {
    const s = await ctx.game.start("u1");
    expect(s.status).toBe("traveling");
    expect(s.stage?.order).toBe(1);
    expect(s.stage?.clue.text).toBe(content.stages[0].clue);
    const raw = JSON.stringify(s);
    expect(raw).not.toContain(content.stages[0].title);
    expect(raw).not.toContain("demo-1");
    expect(raw).not.toContain("RM1");
    expect(raw).not.toContain(content.stages[1].clue);
    expect(raw).not.toContain(content.stages[1].title);
    expect(s.completed).toEqual([]);
  });

  it("bấm bắt đầu lần nữa không đổi started_at", async () => {
    const a = await ctx.game.start("u1");
    ctx.clock.advance(60_000);
    const b = await ctx.game.start("u1");
    expect(b.player.startedAt).toBe(a.player.startedAt);
  });

  it("chưa bấm bắt đầu thì chưa quét được", async () => {
    const r = await ctx.game.scan("u1", { token: "demo-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_started");
  });

  it("quét mã chặng 2 khi chặng 1 chưa xong bị chặn", async () => {
    await ctx.game.start("u1");
    const r = await ctx.game.scan("u1", { token: "demo-2" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong_stage");
    expect((await ctx.game.getState("u1")).stage?.order).toBe(1);
  });

  it("mã sai hoàn toàn bị từ chối", async () => {
    await ctx.game.start("u1");
    const r = await ctx.game.scan("u1", { token: "khong-ton-tai" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid");
  });

  it("quét đúng mã là qua màn ngay: lộ gợi ý chặng sau, tên địa điểm vừa tìm thấy", async () => {
    await ctx.game.start("u1");
    ctx.clock.advance(15 * 60_000);
    const r = await ctx.game.scan("u1", { token: "https://race.vercel.app/q/demo-1" });
    expect(r.ok && r.kind).toBe("completed");
    if (r.ok && r.kind === "completed") {
      expect(r.order).toBe(1);
      expect(r.successMessage).toBe(content.stages[0].successMessage);
      expect(r.state.stage?.order).toBe(2);
      expect(r.state.stage?.clue.text).toBe(content.stages[1].clue);
      expect(r.state.completed[0]).toMatchObject({ order: 1, title: content.stages[0].title, durationS: 900 });
      expect(JSON.stringify(r)).not.toContain(content.stages[1].title);
    }
  });

  it("quét bằng mã chữ in dưới QR cũng được", async () => {
    await ctx.game.start("u1");
    const r = await ctx.game.scan("u1", { code: "rm 1" });
    expect(r.ok && r.kind).toBe("completed");
  });

  it("quét lại mã của chặng đã xong: chỉ xem lại, không đổi tiến độ", async () => {
    await ctx.game.start("u1");
    await ctx.game.scan("u1", { token: "demo-1" });
    const r = await ctx.game.scan("u1", { token: "demo-1" });
    expect(r.ok && r.kind).toBe("review");
    if (r.ok && r.kind === "review") expect(r.stage.clue.text).toBe(content.stages[0].clue);
    expect((await ctx.game.getState("u1")).stage?.order).toBe(2);
  });

  it("chạy trọn 4 chặng tới màn về đích", async () => {
    await ctx.game.start("u1");
    for (let i = 0; i < 4; i++) {
      const before = await ctx.game.getState("u1");
      expect(before.stage?.order).toBe(i + 1);
      ctx.clock.advance(10 * 60_000);
      const r = await ctx.game.scan("u1", { token: `demo-${i + 1}` });
      expect(r.ok && r.kind).toBe("completed");
      if (r.ok && r.kind === "completed") expect(r.state.status).toBe(i === 3 ? "finished" : "traveling");
    }
    const end = await ctx.game.getState("u1");
    expect(end.status).toBe("finished");
    expect(end.stage).toBeNull();
    expect(end.player.finishedAt).not.toBeNull();
    expect(end.completed.map((c) => c.order)).toEqual([1, 2, 3, 4]);
    expect(end.completed.every((c) => c.durationS === 600)).toBe(true);
  });

  it("mở khóa tay bằng cách sửa current_stage (như trong Table Editor)", async () => {
    await ctx.game.start("u1");
    ctx.store.players[0].current_stage = 3;
    const s = await ctx.game.getState("u1");
    expect(s.status).toBe("traveling");
    expect(s.stage?.order).toBe(3);
    // Chặng mở khóa tay: có trong danh sách đã xong nhưng không có thời gian
    expect(s.completed.map((c) => c.order)).toEqual([1, 2]);
    expect(s.completed[0].durationS).toBeNull();
    const r = await ctx.game.scan("u1", { token: "demo-3" });
    expect(r.ok && r.kind).toBe("completed");
  });
});

describe("extractToken", () => {
  it("đọc token từ link hoặc chuỗi trần", () => {
    expect(extractToken("https://x.vercel.app/q/abc_DEF-123")).toBe("abc_DEF-123");
    expect(extractToken("abc123")).toBe("abc123");
    expect(extractToken("không hợp lệ")).toBe("");
  });
});
