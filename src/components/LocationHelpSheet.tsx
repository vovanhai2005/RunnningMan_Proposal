"use client";
import { Kicker, Sheet } from "./ui";

/** Hướng dẫn bật lại quyền vị trí trên iPhone (Safari không hỏi lại sau khi bị từ chối). */
export function LocationHelpSheet({ onClose }: { onClose: () => void }) {
  const steps = [
    {
      title: "Bật Dịch vụ định vị",
      body: (
        <>
          Mở <b>Cài đặt</b> → <b>Quyền riêng tư &amp; Bảo mật</b> → <b>Dịch vụ định vị</b>, bật công tắc
          trên cùng.
        </>
      ),
      mock: ["Quyền riêng tư & Bảo mật", "Dịch vụ định vị", "Bật"],
    },
    {
      title: "Cho phép Safari dùng vị trí",
      body: (
        <>
          Cũng trong mục đó, kéo xuống chọn <b>Trang web Safari</b> → <b>Khi dùng ứng dụng</b>, và bật{" "}
          <b>Vị trí chính xác</b>.
        </>
      ),
      mock: ["Trang web Safari", "Khi dùng ứng dụng", "Vị trí chính xác"],
    },
    {
      title: "Cho phép trang này",
      body: (
        <>
          Quay lại Safari, chạm <b>aA</b> (hoặc biểu tượng ☰) trên thanh địa chỉ →{" "}
          <b>Cài đặt trang web</b> → <b>Vị trí</b> → <b>Cho phép</b>.
        </>
      ),
      mock: ["aA", "Cài đặt trang web", "Vị trí: Cho phép"],
    },
    {
      title: "Tải lại trang",
      body: <>Bấm nút bên dưới. Tiến trình của bạn vẫn được giữ nguyên.</>,
      mock: null,
    },
  ];

  return (
    <Sheet onClose={onClose} closeLabel="Để sau">
      <Kicker className="mt-2">Vị trí đang tắt</Kicker>
      <h2 className="mt-1 pr-24 text-[24px] font-extrabold leading-tight">
        Bật vị trí để thấy mình trên bản đồ
      </h2>
      <p className="mt-2 text-muted">
        Không bật cũng vẫn chơi được: bản đồ vẫn hiện điểm đến, và bạn vẫn quét mã để nhận câu đố.
      </p>
      <ol className="mt-5 flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={i} className="rounded-2xl border border-line p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[15px] font-bold text-white">
                {i + 1}
              </span>
              <span className="font-bold">{s.title}</span>
            </div>
            <p className="mt-2 text-[16px]">{s.body}</p>
            {s.mock && (
              <div className="mt-3 overflow-hidden rounded-xl bg-[#F2F2F7] text-[15px]">
                {s.mock.map((m, j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between border-b border-[#E1E1E6] bg-white px-4 py-2.5 last:border-0"
                  >
                    <span>{m}</span>
                    <span className="text-[#C7C7CC]">{j === s.mock!.length - 1 ? "✓" : "›"}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <button className="btn btn-primary mt-5 w-full" onClick={() => window.location.reload()}>
        Tải lại trang
      </button>
    </Sheet>
  );
}
