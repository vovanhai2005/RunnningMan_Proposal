"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
  /** Mất sóng / không tới được máy chủ */
  get offline() {
    return this.status === 0;
  }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new ApiError(0, "offline", "Mất kết nối mạng. Kiểm tra sóng 4G rồi thử lại nhé.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* bỏ qua */
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, d.error ?? "server", d.message ?? "Có lỗi xảy ra, thử lại nhé.");
  }
  return data as T;
}
