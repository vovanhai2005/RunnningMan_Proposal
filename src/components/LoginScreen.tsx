"use client";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/client/api";
import { Sparkles, Spinner } from "./ui";

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
    <main className="app-screen sky flex flex-col overflow-y-auto">
      <Sparkles />
      <div className="relative flex flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8">
          <h1 className="display-title display-hero text-[48px]">Vào cuộc đua</h1>
          <p className="mt-3 max-w-[34ch] text-muted">
            Nhập tài khoản và mật khẩu Ban tổ chức đã gửi cho bạn.
          </p>
        </div>

        <form onSubmit={submit} className="candy-panel flex flex-col gap-3 p-5">
          <label className="pl-1 text-[15px] font-semibold text-ink/80" htmlFor="username">
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
          <label className="mt-2 pl-1 text-[15px] font-semibold text-ink/80" htmlFor="password">
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
            <p role="alert" className="mt-1 rounded-2xl bg-[#FFE6EF] px-4 py-3 text-[15px] font-medium text-[#A8204F]">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy}>
            {busy ? <Spinner /> : "Đăng nhập"}
          </button>
        </form>
      </div>
    </main>
  );
}
