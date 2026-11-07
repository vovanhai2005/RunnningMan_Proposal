"use client";
import { useEffect } from "react";

/** Lỗi bất ngờ ở bất kỳ màn nào: không hiện mã lỗi, chỉ mời tải lại (tiến trình nằm trên server). */
export default function Error({ error }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="app-screen race-stripes flex flex-col items-center justify-center px-8 text-center text-white">
      <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-white/10 text-4xl">🛠️</div>
      <h1 className="text-[26px] font-extrabold leading-tight">Ối, có chút trục trặc</h1>
      <p className="mt-3 max-w-[340px] text-white/75">
        Tiến trình của bạn vẫn được lưu an toàn. Tải lại trang để chơi tiếp nhé.
      </p>
      <button className="btn btn-primary mt-8 w-full max-w-[340px]" onClick={() => window.location.reload()}>
        Tải lại trang
      </button>
    </main>
  );
}
