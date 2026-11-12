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

  it("bắt đầu: chỉ lộ gợi ý chặng 1, không lộ tên, tọa độ, gợi ý QR, mã QR hay chặng sau", async () => {
    const s = await ctx.game.start("u1");
    expect(s.status).toBe("traveling");
    expect(s.stage?.order).toBe(1);
    expect(s.stage?.phase).toBe("solve");
    expect(s.stage?.clue.text).toBe(content.stages[0].clue);
    expect(s.stage?.place).toBeNull();
    expect(s.stage?.target).toBeNull();
    expect(s.stage?.qrHint).toBeNull();
    const raw = JSON.stringify(s);
    expect(raw).not.toContain(content.stages[0].qrHint);
    expect(raw).not.toContain(String(content.stages[0].lat));
    expect(raw).not.toContain(content.stages[0].title);
    expect(raw).not.toContain(content.stages[0].address);
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

  it("gõ sai tên địa điểm: báo sai, vẫn ở bước đoán", async () => {
    await ctx.game.start("u1");
    const r = await ctx.game.answer("u1", "Hồ Tây");
    expect(r).toMatchObject({ ok: true, correct: false });
    const s = await ctx.game.getState("u1");
    expect(s.stage?.phase).toBe("solve");
    expect(ctx.store.progress[0].wrong_attempts).toBe(1);
  });

  it("gõ đúng (không dấu, thêm chữ thừa): lộ tên + địa chỉ + tọa độ, chưa lộ gợi ý QR", async () => {
    await ctx.game.start("u1");
    const r = await ctx.game.answer("u1", "chắc là ho guom!");
    expect(r.ok && r.correct).toBe(true);
    if (r.ok && r.correct) {
      expect(r.state.stage?.phase).toBe("travel");
      expect(r.state.stage?.place).toEqual({
        title: content.stages[0].title,
        address: content.stages[0].address,
        lat: content.stages[0].lat,
        lng: content.stages[0].lng,
      });
      expect(r.state.stage?.target).toEqual({ lat: content.stages[0].lat, lng: content.stages[0].lng });
      expect(r.state.stage?.qrHint).toBeNull();
      expect(JSON.stringify(r)).not.toContain(content.stages[0].qrHint);
    }
  });

  it("chặng chưa có đáp án (chưa push nội dung mới): chỉ hiện gợi ý, không lộ tên địa điểm", async () => {
    ctx.store.stages.forEach((s) => (s.answers = []));
    const s = await ctx.game.start("u1");
    expect(s.stage?.phase).toBe("travel");
    expect(s.stage?.place).toBeNull();
    expect(s.stage?.clue.text).toBe(content.stages[0].clue);
    expect(JSON.stringify(s)).not.toContain(content.stages[0].title);
    const r = await ctx.game.arrive("u1", { lat: content.stages[0].lat, lng: content.stages[0].lng });
    expect(r.ok && r.state.stage?.phase).toBe("search");
  });

  it("chưa đoán ra địa điểm thì báo đến nơi bị từ chối", async () => {
    await ctx.game.start("u1");
    const r = await ctx.game.arrive("u1", { lat: content.stages[0].lat, lng: content.stages[0].lng });
    expect(r).toMatchObject({ ok: false, reason: "not_ready" });
  });

  it("đến nơi: server đo lại khoảng cách, trong 1 km mới lộ gợi ý chỗ giấu mã QR", async () => {
    await ctx.game.start("u1");
    await ctx.game.answer("u1", "Hồ Gươm");
    const { lat, lng } = content.stages[0];
    const far = await ctx.game.arrive("u1", { lat: lat + 0.012, lng }); // ~1,3 km
    expect(far).toMatchObject({ ok: false, reason: "too_far" });
    const near = await ctx.game.arrive("u1", { lat: lat + 0.007, lng }); // ~780 m
    expect(near.ok).toBe(true);
    if (near.ok) {
      expect(near.state.stage?.phase).toBe("search");
      expect(near.state.stage?.qrHint).toBe(content.stages[0].qrHint);
      expect(near.state.stage?.target).toBeNull();
    }
    // Mở lại app vẫn ở bước tìm mã
    expect((await ctx.game.getState("u1")).stage?.phase).toBe("search");
  });

  it("quét đúng mã là qua màn; màn sau lại bắt đầu bằng gợi ý, chưa lộ địa điểm", async () => {
    await ctx.game.start("u1");
    await ctx.game.answer("u1", "Hồ Gươm");
    await ctx.game.arrive("u1", { lat: content.stages[0].lat, lng: content.stages[0].lng });
    const r = await ctx.game.scan("u1", { token: "https://race.vercel.app/q/demo-1" });
    expect(r.ok && r.kind).toBe("completed");
    if (r.ok && r.kind === "completed") {
      expect(r.order).toBe(1);
      expect(r.successMessage).toBe(content.stages[0].successMessage);
      expect(r.state.stage?.order).toBe(2);
      expect(r.state.stage?.phase).toBe("solve");
      expect(r.state.stage?.clue.text).toBe(content.stages[1].clue);
      expect(r.state.stage?.place).toBeNull();
      expect(r.state.completed[0].place.title).toBe(content.stages[0].title);
      expect(JSON.stringify(r)).not.toContain(content.stages[1].title);
      expect(JSON.stringify(r)).not.toContain(content.stages[2].clue);
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
    if (r.ok && r.kind === "review") expect(r.stage.clue?.text).toBe(content.stages[0].clue);
    expect((await ctx.game.getState("u1")).stage?.order).toBe(2);
  });

  it("chạy trọn 4 chặng (đoán → đến nơi → quét) tới màn về đích", async () => {
    await ctx.game.start("u1");
    for (let i = 0; i < 4; i++) {
      const before = await ctx.game.getState("u1");
      expect(before.stage?.order).toBe(i + 1);
      const st = content.stages[i];
      expect((await ctx.game.answer("u1", st.answers[0])).ok).toBe(true);
      expect((await ctx.game.arrive("u1", { lat: st.lat, lng: st.lng })).ok).toBe(true);
      ctx.clock.advance(10 * 60_000);
      const r = await ctx.game.scan("u1", { token: `demo-${i + 1}` });
      expect(r.ok && r.kind).toBe("completed");
      if (r.ok && r.kind === "completed") expect(r.state.status).toBe(i === 3 ? "finished" : "traveling");
    }
    const end = await ctx.game.getState("u1");
    expect(end.status).toBe("finished");
    expect(end.stage).toBeNull();
    expect(end.player.finishedAt).not.toBeNull();
    expect(end.completed.map((c) => c.place.title)).toEqual(content.stages.map((s) => s.title));
  });

  it("chơi lại từ đầu: xóa tiến độ, về màn chào mừng, chơi lại được như mới", async () => {
    await ctx.game.start("u1");
    await ctx.game.scan("u1", { token: "demo-1" });
    await ctx.game.scan("u1", { token: "demo-2" });
    const r = await ctx.game.reset("u1");
    expect(r.status).toBe("not_started");
    expect(r.stage).toBeNull();
    expect(r.completed).toEqual([]);
    expect(r.player.startedAt).toBeNull();
    expect(ctx.store.progress).toEqual([]);
    const s = await ctx.game.start("u1");
    expect(s.stage?.order).toBe(1);
    const again = await ctx.game.scan("u1", { token: "demo-1" });
    expect(again.ok && again.kind).toBe("completed");
  });

  it("mở khóa tay bằng cách sửa current_stage (như trong Table Editor)", async () => {
    await ctx.game.start("u1");
    ctx.store.players[0].current_stage = 3;
    const s = await ctx.game.getState("u1");
    expect(s.status).toBe("traveling");
    expect(s.stage?.order).toBe(3);
    expect(s.completed.map((c) => c.order)).toEqual([1, 2]);
    expect(s.stage?.phase).toBe("solve");
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
