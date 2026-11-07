"use client";
import { useEffect } from "react";

/** Lỗi bất ngờ ở bất kỳ màn nào: không hiện mã lỗi, chỉ mời tải lại (tiến trình nằm trên server). */
export default function Error({ error }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="app-screen sky flex flex-col items-center justify-center px-8 text-center">
      <div className="puff mb-6 grid h-20 w-20 place-items-center rounded-full text-4xl">🛠️</div>
      <h1 className="display-title text-[28px]">Ối, có chút trục trặc</h1>
      <p className="mt-3 max-w-[340px] text-muted">
        Tiến trình của bạn vẫn được lưu an toàn. Tải lại trang để chơi tiếp nhé.
      </p>
      <button className="btn btn-primary mt-8 w-full max-w-[340px]" onClick={() => window.location.reload()}>
        Tải lại trang
      </button>
    </main>
  );
}
