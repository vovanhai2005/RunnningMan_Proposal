import { beforeEach, describe, expect, it } from "vitest";
import content from "../../content/stages.example.json";
import { extractToken, Game } from "./game";
import { MemoryStore, stagesFromContent } from "./store/memory";

import { chapterOf, memoriesOf } from "./story";

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

  it("trạm nghỉ trước chặng 3: lộ điểm đến ngay, nghỉ xong mới đi tiếp được", async () => {
    await ctx.game.start("u1");
    await ctx.game.scan("u1", { token: "demo-1" });
    const r = await ctx.game.scan("u1", { token: "demo-2" });
    expect(r.ok && r.kind).toBe("completed");
    if (r.ok && r.kind === "completed") {
      const st = r.state.stage!;
      expect(st.order).toBe(3);
      expect(st.phase).toBe("rest");
      // Màn 3 không có gợi ý: quét mã màn 2 là lộ luôn điểm đến, kể cả khi còn trạm nghỉ
      expect(st.place?.title).toBe(content.stages[2].title);
      expect(st.target).toBeNull();
      expect(st.qrHint).toBeNull();
      expect(st.rest).toMatchObject({
        label: "Chặng 2.5",
        done: false,
        place: { title: "24 Phố Trạm" },
      });
      expect(st.rest?.note).toContain("nghỉ chân");
      expect(JSON.stringify(r)).not.toContain(content.stages[3].title);
    }
    // Đang nghỉ thì chưa "đến nơi" được
    const early = await ctx.game.arrive("u1", { lat: content.stages[2].lat, lng: content.stages[2].lng });
    expect(early.ok).toBe(false);
    const s = await ctx.game.finishRest("u1");
    expect(s.stage?.phase).toBe("travel");
    expect(s.stage?.rest?.done).toBe(true);
    // Mở lại app vẫn đã nghỉ xong; bấm lần nữa không đổi gì
    expect((await ctx.game.finishRest("u1")).stage?.phase).toBe("travel");
  });

  it("màn không có gợi ý (màn 3, 4): nghỉ xong là lộ ngay tên + địa chỉ", async () => {
    await ctx.game.start("u1");
    await ctx.game.scan("u1", { token: "demo-1" });
    await ctx.game.scan("u1", { token: "demo-2" });
    const r = { ok: true, kind: "completed", state: await ctx.game.finishRest("u1") } as const;
    if (r.ok) {
      expect(r.state.stage?.order).toBe(3);
      expect(r.state.stage?.phase).toBe("travel");
      expect(r.state.stage?.place).toEqual({
        title: content.stages[2].title,
        address: content.stages[2].address,
        lat: content.stages[2].lat,
        lng: content.stages[2].lng,
      });
      expect(r.state.stage?.qrHint).toBeNull();
      expect(JSON.stringify(r)).not.toContain(content.stages[3].title);
    }
    const near = await ctx.game.arrive("u1", { lat: content.stages[2].lat, lng: content.stages[2].lng });
    expect(near.ok && near.state.stage?.qrHint).toBe(content.stages[2].qrHint);
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

  it("tên chặng chỉ lộ cho chặng đang mở; ảnh kỷ niệm chỉ có sau khi quét được mã", async () => {
    const s = await ctx.game.start("u1");
    expect(s.stage?.chapter).toEqual(chapterOf(1));
    const raw = JSON.stringify(s);
    for (const order of [2, 3, 4]) expect(raw).not.toContain(chapterOf(order)!.title);
    for (const m of [1, 2, 3].flatMap(memoriesOf)) expect(raw).not.toContain(m.src);

    const r = await ctx.game.scan("u1", { token: "demo-1" });
    expect(r.ok && r.kind).toBe("completed");
    if (r.ok && r.kind === "completed") {
      const done = r.state.completed.find((c) => c.order === 1)!;
      expect(done.memories).toEqual(memoriesOf(1));
      expect(done.chapter).toEqual(chapterOf(1));
      expect(r.state.stage?.chapter).toEqual(chapterOf(2));
      const after = JSON.stringify(r.state);
      for (const m of memoriesOf(2)) expect(after).not.toContain(m.src);
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
      if (before.stage?.phase === "rest") await ctx.game.finishRest("u1");
      if (st.answers) expect((await ctx.game.answer("u1", st.answers[0])).ok).toBe(true);
      expect((await ctx.game.arrive("u1", { lat: st.lat, lng: st.lng })).ok).toBe(true);
      ctx.clock.advance(10 * 60_000);
      const scanned = await ctx.game.scan("u1", { token: `demo-${i + 1}` });
      if (i === 3) {
        // Chặng cuối: quét xong còn câu hỏi
        expect(scanned.ok && scanned.kind).toBe("quiz");
        const q = await ctx.game.quiz("u1", "Deadpool!");
        expect(q.ok && q.correct).toBe(true);
        if (q.ok && q.correct) expect(q.state.status).toBe("finished");
        continue;
      }
      expect(scanned.ok && scanned.kind).toBe("completed");
      if (scanned.ok && scanned.kind === "completed") expect(scanned.state.status).toBe("traveling");
    }
    const end = await ctx.game.getState("u1");
    expect(end.status).toBe("finished");
    expect(end.stage).toBeNull();
    expect(end.player.finishedAt).not.toBeNull();
    expect(end.completed.map((c) => c.place.title)).toEqual(content.stages.map((s) => s.title));
  });

  it("chặng 4: quét mã xong hiện câu hỏi; gợi ý chỉ mở sau 5 phút chưa trả lời đúng", async () => {
    await ctx.game.start("u1");
    ctx.store.players[0].current_stage = 4;
    const r = await ctx.game.scan("u1", { token: "demo-4" });
    expect(r.ok && r.kind).toBe("quiz");
    if (!(r.ok && r.kind === "quiz")) return;
    const quiz = r.state.stage?.quiz;
    expect(r.state.stage?.phase).toBe("quiz");
    expect(quiz?.question).toContain("Món quà đầu tiên");
    expect(quiz?.hint).toBeNull();
    // Không lộ đáp án hay gợi ý trước giờ
    expect(JSON.stringify(r).toLowerCase()).not.toContain("deadpool");
    expect(JSON.stringify(r)).not.toContain("phong bì");

    const wrong = await ctx.game.quiz("u1", "con mèo");
    expect(wrong).toMatchObject({ ok: true, correct: false });

    ctx.clock.advance(4 * 60_000 + 59_000);
    expect((await ctx.game.getState("u1")).stage?.quiz?.hint).toBeNull();
    // Quét lại không đặt lại đồng hồ gợi ý
    const again = await ctx.game.scan("u1", { token: "demo-4" });
    expect(again.ok && again.kind).toBe("quiz");
    ctx.clock.advance(2_000);
    const s = await ctx.game.getState("u1");
    expect(s.stage?.quiz?.hint).toContain("phong bì");
    expect(s.status).toBe("traveling");

    const right = await ctx.game.quiz("u1", "con Dead-pool");
    expect(right.ok && right.correct).toBe(true);
    if (right.ok && right.correct) {
      expect(right.order).toBe(4);
      expect(right.state.status).toBe("finished");
    }
  });

  it("chưa quét mã chặng 4 thì chưa trả lời câu hỏi được", async () => {
    await ctx.game.start("u1");
    ctx.store.players[0].current_stage = 4;
    expect(await ctx.game.quiz("u1", "deadpool")).toMatchObject({ ok: false, reason: "not_ready" });
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
    expect(s.stage?.phase).toBe("rest");
    expect((await ctx.game.finishRest("u1")).stage?.phase).toBe("travel");
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
