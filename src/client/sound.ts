"use client";

/**
 * Âm thanh tổng hợp bằng Web Audio — không cần file. Safari chặn phát âm thanh trước
 * khi người dùng chạm, nên phải gọi `unlockAudio()` ngay trong sự kiện chạm (nút "Bắt đầu").
 */
let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    // Phát một mẫu im lặng để "mở khóa" trên iOS
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* không có âm thanh thì thôi */
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "triangle", vol = 0.25) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function ready() {
  if (!ctx) return false;
  if (ctx.state === "suspended") void ctx.resume();
  return true;
}

export const sfx = {
  /** Quét mã thành công */
  scan() {
    if (!ready()) return;
    tone(880, 0, 0.12, "square", 0.12);
    tone(1320, 0.1, 0.18, "square", 0.12);
  },
  /** Trả lời đúng: hồi kèn ngắn */
  success() {
    if (!ready()) return;
    [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.12, 0.2));
    tone(1046.5, 0.36, 0.6, "triangle", 0.3);
    tone(783.99, 0.36, 0.6, "sine", 0.15);
  },
  /** Trả lời sai */
  wrong() {
    if (!ready()) return;
    tone(196, 0, 0.18, "sawtooth", 0.12);
    tone(147, 0.16, 0.3, "sawtooth", 0.12);
  },
  /** Về đích */
  finish() {
    if (!ready()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => tone(f, i * 0.14, i === notes.length - 1 ? 1.2 : 0.2, "triangle", 0.28));
  },
};
