"use client";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/client/api";
import { Spinner } from "./ui";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/login", { username, password });
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra, thử lại nhé.");
      setBusy(false);
    }
  }

  return (
    <main className="app-screen race-stripes flex flex-col overflow-y-auto text-white">
      <div className="flex flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] font-bold uppercase tracking-[0.16em] text-yellow">
            <span className="h-2 w-2 rounded-full bg-accent" /> Ban tổ chức
          </div>
          <h1 className="race-title text-[44px]">
            Vào
            <br />
            <span className="text-yellow">cuộc đua</span>
          </h1>
          <p className="mt-4 text-white/75">
            Nhập tài khoản và mật khẩu Ban tổ chức đã gửi cho bạn.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-[15px] font-semibold text-white/80" htmlFor="username">
            Tài khoản
          </label>
          <input
            id="username"
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="next"
            required
          />
          <label className="mt-2 text-[15px] font-semibold text-white/80" htmlFor="password">
            Mật khẩu
          </label>
          <input
            id="password"
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            enterKeyHint="go"
            required
          />
          {error && (
            <p role="alert" className="mt-1 rounded-xl bg-bad/15 px-4 py-3 text-[15px] text-[#FFB3BC]">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary mt-5 w-full" disabled={busy}>
            {busy ? <Spinner /> : "Đăng nhập"}
          </button>
        </form>
      </div>
    </main>
  );
}
