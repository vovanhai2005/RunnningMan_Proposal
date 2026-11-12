"use client";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type SubmitEvent,
  type ReactNode,
} from "react";
import type { CompletedStage, GameState, PublicClue, PublicStage } from "@/lib/types";
import type { GeoStatus } from "@/hooks/useGeolocation";
import { celebrate } from "@/client/device";
import { sfx } from "@/client/sound";
import { PlaceCard } from "./PlaceCard";
import { CandyName, Medal, Ribbon, Spinner } from "./ui";

/** Khi quay về bản đồ màn chơi: avatar nhảy từ màn `from` sang màn hiện tại, rồi mở bảng của màn `open` */
export type MapIntro = { from: number | null; open: number | null };

// ---- Hình học bản đồ (đơn vị viewBox, co giãn theo bề rộng màn hình) ----
const W = 360;
const GAP = 150; // khoảng cách dọc giữa hai màn
const PAD_TOP = 250; // chỗ cho biển mây (hoặc cờ về đích) + thanh trên
const PAD_BOTTOM = 120;

type Pt = { x: number; y: number };

/**
 * Điểm 0 = xuất phát, 1..count. Điểm cuối là màn bí mật (chưa về đích) hoặc đích (đã về đích, căn giữa).
 * Màn xen kẽ phải/trái để đường uốn chữ S. Bản đồ chỉ dài tới màn bí mật nên không lộ tổng số nhiệm vụ.
 */
function layout(count: number, finishAtTop: boolean) {
  const H = PAD_TOP + PAD_BOTTOM + count * GAP;
  const pts: Pt[] = [];
  for (let i = 0; i <= count; i++) {
    const center = i === 0 || (finishAtTop && i === count);
    pts.push({
      x: center ? W / 2 : i % 2 ? 268 : 92,
      y: H - PAD_BOTTOM - i * GAP,
    });
  }
  return { H, pts };
}

/** Đoạn i nối điểm i → i+1, tiếp tuyến thẳng đứng ở mỗi màn cho khúc cua mềm */
function segment(a: Pt, b: Pt) {
  const k = GAP * 0.58;
  return `C ${a.x} ${a.y - k} ${b.x} ${b.y + k} ${b.x} ${b.y}`;
}
function roadPath(pts: Pt[], from: number, to: number) {
  if (to <= from) return "";
  let d = `M ${pts[from].x} ${pts[from].y}`;
  for (let i = from; i < to; i++) d += " " + segment(pts[i], pts[i + 1]);
  return d;
}

/** Mỗi màn tìm thấy được 3 sao */
const STARS_PER_LEVEL = 3;
const NO_LOCATION: GeoStatus[] = ["denied", "unavailable", "insecure"];

type Selected = { kind: "stage"; order: number } | { kind: "locked" } | { kind: "finish" };

export function GameMap({
  state,
  near,
  geoStatus,
  online,
  intro,
  onIntroDone,
  onScan,
  onAnswer,
  onLocationHelp,
  onReset,
}: {
  state: GameState;
  /** Đang ở trong bán kính 1 km quanh điểm đến của màn hiện tại */
  near: boolean;
  geoStatus: GeoStatus;
  online: boolean;
  intro: MapIntro | null;
  onIntroDone: () => void;
  onScan: () => void;
  /** Gửi tên địa điểm đoán được; trả về lời báo sai, hoặc null khi đúng */
  onAnswer: (answer: string) => Promise<string | null>;
  onLocationHelp: () => void;
  /** Xóa toàn bộ tiến độ, quay về màn chào mừng */
  onReset: () => Promise<void>;
}) {
  const total = state.totalStages;
  const finishedAll = state.status === "finished";
  const current = state.stage?.order ?? total + 1;
  /** Chỉ số điểm cuối trên bản đồ: màn bí mật ngay sau màn hiện tại, hoặc đích khi đã về đích */
  const last = finishedAll ? total + 1 : current + 1;
  const { H, pts } = useMemo(() => layout(last, finishedAll), [last, finishedAll]);
  const done = useMemo(() => new Map(state.completed.map((c) => [c.order, c])), [state.completed]);
  const stars = state.completed.length * STARS_PER_LEVEL;
  /** Đã tới nơi, đang tìm mã QR: nút quét nảy lên */
  const hot = near || state.stage?.phase === "search";

  const moving = intro?.from != null && intro.from !== current;
  const [selected, setSelected] = useState<Selected | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // Vị trí avatar (chỉ số điểm); khác `current` trong lúc chạy hiệu ứng chuyển màn
  const [avatarAt, setAvatarAt] = useState(() => intro?.from ?? current);
  /** Điểm đang phá xích (màn mới hoặc đích) và màn bí mật mới đang trồi lên khỏi mây */
  const [unlocking, setUnlocking] = useState<number | null>(() => (moving ? current : null));
  const [emerging, setEmerging] = useState(() => moving && !finishedAll);

  const scrollRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  /** Cuộn để điểm i nằm giữa màn hình (hơi lệch xuống để chừa chỗ avatar) */
  function scrollTo(i: number, smooth: boolean) {
    const sc = scrollRef.current;
    const board = boardRef.current;
    if (!sc || !board) return;
    const scale = board.offsetWidth / W;
    const top = board.offsetTop + pts[i].y * scale - sc.clientHeight * 0.55;
    sc.scrollTo({
      top: Math.max(0, top),
      behavior: smooth ? "smooth" : "auto",
    });
  }

  useLayoutEffect(() => {
    // Lúc mở khóa: đứng ở màn cũ, màn sắp phá xích nằm ngay phía trên trong khung nhìn
    scrollTo(intro?.from ?? current, false);
    // chỉ khi mở bản đồ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Hiệu ứng sau khi xong một màn (khớp thời gian với CSS .is-breaking):
   * 0.2–1s ổ khóa rung · 1.05s xích đứt, màn mới bật lên · 1.9s avatar nhảy sang ·
   * 2.3s màn bí mật mới trồi khỏi mây · 3s mở bảng (hoặc màn chúc mừng khi về đích).
   */
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    if (moving) {
      at(1050, () => sfx.unlock());
      at(1900, () => {
        setAvatarAt(current);
        scrollTo(current, true);
      });
      at(3000, () => {
        setUnlocking(null);
        setEmerging(false);
        if (finishedAll) {
          sfx.finish();
          setSelected({ kind: "finish" });
        } else if (intro?.open != null) {
          setSelected({ kind: "stage", order: intro.open });
        }
        onIntroDone();
      });
    } else if (finishedAll) {
      // Mở lại app sau khi đã về đích: vào thẳng màn chúc mừng
      at(350, () => setSelected({ kind: "finish" }));
    } else if (intro) {
      at(350, () => {
        if (intro.open != null) setSelected({ kind: "stage", order: intro.open });
        onIntroDone();
      });
    }
    return () => timers.forEach(clearTimeout);
    // chỉ chạy một lần cho mỗi lần mở bản đồ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = (p: Pt) => ({
    left: `${(p.x / W) * 100}%`,
    top: `${(p.y / H) * 100}%`,
  });
  const reached = Math.min(current, last);
  const fullRoad = roadPath(pts, 0, last);
  const doneRoad = roadPath(pts, 0, reached);
  const aheadRoad = roadPath(pts, reached, last);
  // Đường tiếp tục sau màn bí mật rồi chìm vào mây — không biết còn bao xa
  const top = pts[last];
  const fogRoad = finishedAll
    ? ""
    : `M ${top.x} ${top.y} C ${top.x} ${top.y - GAP * 0.55} ${W / 2} ${top.y - GAP * 0.5} ${W / 2} ${top.y - GAP * 0.8}`;
  const shown = finishedAll ? total : current;

  return (
    <main className="app-screen !p-0 lvl-world">
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto overscroll-contain">
        {/* Đầu cuộc đua bản đồ còn ngắn: đặt sát đáy màn hình để đồi cỏ luôn ở dưới cùng */}
        <div className="flex min-h-full flex-col justify-end">
          <div
            ref={boardRef}
            className="relative mx-auto w-full max-w-[480px] shrink-0"
            style={{ aspectRatio: `${W} / ${H}` }}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <Scenery pts={pts} H={H} last={last} />
              {/* Con đường kẹo: bóng, viền nho, mặt đường, chấm giữa đường */}
              <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path
                  d={fullRoad + " " + fogRoad}
                  stroke="rgba(46,15,82,0.16)"
                  strokeWidth="42"
                  transform="translate(0 7)"
                />
                <path d={fullRoad + " " + fogRoad} stroke="var(--grape)" strokeWidth="36" />
                <path d={aheadRoad + " " + fogRoad} stroke="#ebe8fb" strokeWidth="27" />
                <path d={doneRoad} stroke="#ffe48a" strokeWidth="27" />
                <path d={doneRoad} stroke="#fff6c9" strokeWidth="12" opacity="0.9" />
                <path
                  d={aheadRoad + " " + fogRoad}
                  stroke="#fff"
                  strokeWidth="6"
                  strokeDasharray="0 17"
                />
                <path d={doneRoad} stroke="var(--accent)" strokeWidth="7" strokeDasharray="0 17" />
              </g>
              {!finishedAll && <FogBank x={W / 2} y={top.y - GAP * 0.9} />}
            </svg>

            {/* Vạch xuất phát */}
            <div className="lvl-start" style={pct(pts[0])}>
              <span>Xuất phát</span>
            </div>

            {/* Các màn đã mở (đã xong + đang chơi) */}
            {Array.from({ length: shown }, (_, k) => k + 1).map((order) => {
              const c = done.get(order);
              const breaking = unlocking === order;
              const label = c
                ? `Nhiệm vụ ${order}, đã hoàn thành, ${STARS_PER_LEVEL} sao`
                : `Nhiệm vụ ${order}, đang chơi${hot ? ", bạn đã đến nơi" : ""}`;
              return (
                <button
                  key={order}
                  className={`lvl-node ${c ? "is-done" : "is-current"} ${breaking ? "is-unlocking" : ""} ${!c && hot ? "is-near" : ""}`}
                  style={pct(pts[order])}
                  aria-label={label}
                  onClick={() => setSelected({ kind: "stage", order })}
                >
                  <span className="lvl-node-num">{order}</span>
                  {c && <Stars n={STARS_PER_LEVEL} className="lvl-node-stars" />}
                  {breaking && <UnlockFx />}
                </button>
              );
            })}

            {/* Màn bí mật: bị xích, không biết là nhiệm vụ hay đích */}
            {!finishedAll && (
              <button
                key={`mystery-${last}`}
                className={`lvl-node is-locked ${emerging ? "is-emerging" : ""}`}
                style={pct(pts[last])}
                aria-label="Màn tiếp theo, chưa mở khóa"
                onClick={() => setSelected({ kind: "locked" })}
              >
                <span className="lvl-node-num">?</span>
                <Chains />
              </button>
            )}

            {/* Về đích */}
            {finishedAll && (
              <button
                className={`lvl-finish ${unlocking === total + 1 ? "is-unlocking" : ""}`}
                style={pct(pts[total + 1])}
                aria-label="Về đích"
                onClick={() => setSelected({ kind: "finish" })}
              >
                <FinishBadge>{unlocking === total + 1 && <UnlockFx />}</FinishBadge>
              </button>
            )}

            {/* Avatar người chơi đứng trên màn hiện tại (hoặc trên đích) */}
            {avatarAt <= last && (
              <div
                className={`lvl-avatar ${avatarAt !== (intro?.from ?? current) ? "is-hopping" : ""} ${
                  avatarAt === total + 1 && finishedAll ? "is-at-finish" : ""
                }`}
                style={pct(pts[avatarAt])}
                aria-hidden="true"
              >
                <span className="lvl-avatar-hop">
                  <AvatarPin url={state.player.avatarUrl} name={state.player.displayName} />
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thanh trên: số sao đã gom (không lộ tổng số nhiệm vụ) */}
      <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-10 flex items-start justify-between gap-2">
        <div className="lvl-hud" aria-label={`Đã có ${stars} sao`}>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="var(--butter)"
              stroke="var(--grape)"
              strokeWidth="2"
              strokeLinejoin="round"
              d={STAR}
            />
          </svg>
          <b className="num-display text-[20px]" aria-hidden="true">
            {stars}
          </b>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            className="lvl-icon-btn"
            aria-label="Chơi lại từ đầu"
            onClick={() => {
              setSelected(null);
              setConfirmReset(true);
            }}
          >
            <RestartIcon />
          </button>
          {!online && <div className="lvl-hud lvl-hud-dark">📶 Mất sóng</div>}
          {!finishedAll && NO_LOCATION.includes(geoStatus) && (
            <button className="lvl-hud lvl-hud-warn" onClick={onLocationHelp}>
              📍 Chưa bật vị trí
            </button>
          )}
        </div>
      </div>

      {/* Nút quét mã luôn trong tầm ngón cái; nảy lên khi đã ở gần điểm bí mật */}
      {!finishedAll && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+18px)] z-10 flex justify-center">
          <button className={`lvl-scan ${hot ? "is-near" : ""}`} onClick={onScan}>
            <QrIcon />
            Quét mã QR
          </button>
        </div>
      )}

      {confirmReset && (
        <ResetDialog onConfirm={onReset} onClose={() => setConfirmReset(false)} />
      )}

      {selected && (
        <LevelPopup
          selected={selected}
          state={state}
          completed={selected.kind === "stage" ? done.get(selected.order) : undefined}
          near={near}
          geoStatus={geoStatus}
          celebrateNow={finishedAll}
          onClose={() => setSelected(null)}
          onScan={() => {
            setSelected(null);
            onScan();
          }}
          onAnswer={async (answer) => {
            const err = await onAnswer(answer);
            if (!err) setSelected(null);
            return err;
          }}
          onLocationHelp={() => {
            setSelected(null);
            onLocationHelp();
          }}
        />
      )}
    </main>
  );
}

// ======================= Bảng thông tin màn =======================

function LevelPopup({
  selected,
  state,
  completed,
  near,
  geoStatus,
  celebrateNow,
  onClose,
  onScan,
  onAnswer,
  onLocationHelp,
}: {
  selected: Selected;
  state: GameState;
  completed?: CompletedStage;
  near: boolean;
  geoStatus: GeoStatus;
  /** Bảng về đích: bắn pháo giấy vài đợt khi mở */
  celebrateNow: boolean;
  onClose: () => void;
  onScan: () => void;
  onAnswer: (answer: string) => Promise<string | null>;
  onLocationHelp: () => void;
}) {
  const isFinish = selected.kind === "finish";
  useEffect(() => {
    if (!isFinish || !celebrateNow) return;
    void celebrate();
    const t = setInterval(() => void celebrate(), 6000);
    const stop = setTimeout(() => clearInterval(t), 20000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [isFinish, celebrateNow]);

  const isCurrent = selected.kind === "stage" && state.stage?.order === selected.order;
  const heading =
    selected.kind === "finish"
      ? "Về đích"
      : selected.kind === "locked"
        ? "Màn bí mật"
        : `Nhiệm vụ ${selected.order}`;

  let body: ReactNode;
  if (selected.kind === "finish") {
    body = <FinishInfo name={state.player.displayName} onClose={onClose} />;
  } else if (selected.kind === "locked") {
    body = (
      <Locked
        title="Chưa mở khóa"
        text={`Hoàn thành nhiệm vụ ${state.stage?.order ?? ""} để phá xích màn này.`}
        onClose={onClose}
      />
    );
  } else if (completed) {
    body = <DoneInfo c={completed} onClose={onClose} />;
  } else if (isCurrent) {
    body = (
      <CurrentInfo
        stage={state.stage!}
        near={near}
        geoStatus={geoStatus}
        onScan={onScan}
        onAnswer={onAnswer}
        onClose={onClose}
        onLocationHelp={onLocationHelp}
      />
    );
  } else {
    body = null;
  }

  return (
    <CandyDialog heading={heading} onClose={onClose}>
      {body}
    </CandyDialog>
  );
}

/** Khung bảng kiểu game kẹo: ruy băng tiêu đề, nút đóng tròn, nội dung cuộn bên trong */
export function CandyDialog({
  heading,
  onClose,
  children,
  z = "z-40",
}: {
  heading: string;
  onClose: () => void;
  children: ReactNode;
  z?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 ${z} grid place-items-center bg-[#2B2160]/50 px-5 backdrop-blur-[2px] fade-in`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="lvl-popup candy-panel relative w-full max-w-[360px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 -top-6 z-[1] flex justify-center">
          <Ribbon>{heading}</Ribbon>
        </div>
        <button className="lvl-close" onClick={onClose} aria-label="Đóng">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="lvl-popup-scroll px-5 pt-11 pb-5">{children}</div>
      </div>
    </div>
  );
}

/** Vừa vào bán kính 1 km quanh điểm đến: lộ gợi ý chỗ giấu mã QR */
export function ArrivedDialog({
  hint,
  onScan,
  onClose,
}: {
  hint: string;
  onScan: () => void;
  onClose: () => void;
}) {
  return (
    <CandyDialog heading="Đến nơi rồi!" onClose={onClose} z="z-50">
      <div className="flex flex-col items-center text-center">
        <div className="lvl-radar" aria-hidden="true">
          <span />
          <span />
          <QrIcon size={38} />
        </div>
        <p className="mt-5 max-w-[30ch] text-[16px] leading-snug text-muted">
          Bạn đã vào vòng 1 km quanh điểm đến. Nhiệm vụ tiếp theo: tìm mã QR bí mật.
        </p>
        <div className="mt-6 w-full">
          <QrHintCard hint={hint} />
        </div>
        <button className="btn btn-primary mt-6 w-full" onClick={onScan} autoFocus>
          <QrIcon /> Quét mã QR
        </button>
        <button className="btn btn-ghost mt-3 w-full" onClick={onClose}>
          Để sau
        </button>
      </div>
    </CandyDialog>
  );
}

/** Xác nhận trước khi xóa tiến độ — không hoàn tác được */
function ResetDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <CandyDialog heading="Chơi lại" onClose={busy ? () => {} : onClose} z="z-50">
      <div className="flex flex-col items-center text-center">
        <div className="lvl-popup-lock lvl-reset-icon" aria-hidden="true">
          <RestartIcon size={40} />
        </div>
        <h2 className="display-title mt-4 text-[24px]">Chơi lại từ đầu?</h2>
        <p className="mt-2 max-w-[30ch] text-[16px] leading-snug text-muted">
          Mọi màn đã qua sẽ bị xóa và cuộc đua quay về màn chào mừng. Không hoàn tác được.
        </p>
        <button
          className="btn btn-primary btn-danger mt-6 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : "Xóa và chơi lại"}
        </button>
        <button className="btn btn-ghost mt-3 w-full" onClick={onClose} disabled={busy} autoFocus>
          Hủy
        </button>
      </div>
    </CandyDialog>
  );
}

/** Màn chúc mừng khi về đích */
function FinishInfo({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="lvl-popup-medal medal-stage pop-in mt-12">
        <Medal />
      </div>
      <h2 className="mt-6 flex flex-col items-center">
        <span className="candy-sub text-[26px]">Chúc mừng</span>
        <CandyName name={name} maxSize={60} />
      </h2>
      <p className="text-[18px] font-semibold text-ink/85">Bạn đã hoàn thành cuộc đua</p>
      <button className="btn btn-primary mt-7 w-full" onClick={onClose} autoFocus>
        Xem lại bản đồ
      </button>
    </div>
  );
}

/** Thẻ giấy ghi gợi ý địa điểm; `children` là cuống vé xé được (chỗ điền đáp án) */
function ClueCard({
  clue,
  label = "Gợi ý địa điểm",
  children,
}: {
  clue: PublicClue;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <figure className="lvl-clue w-full text-left">
      <figcaption className="lvl-clue-label">{label}</figcaption>
      <p className="whitespace-pre-line text-[17px] leading-relaxed text-ink">{clue.text}</p>
      {clue.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={clue.imageUrl} alt="Hình gợi ý địa điểm" className="mt-3 w-full rounded-2xl" />
      )}
      {children}
    </figure>
  );
}

/** Mảnh giấy tím: gợi ý chỗ giấu mã QR, khác màu thẻ gợi ý địa điểm để không lẫn */
function QrHintCard({ hint }: { hint: string | null }) {
  return (
    <figure className="lvl-clue lvl-secret w-full text-left">
      <figcaption className="lvl-clue-label">Mã QR ở đâu?</figcaption>
      <p className="whitespace-pre-line text-[17px] leading-relaxed text-ink">
        {hint || "Mã QR bí mật được giấu đâu đó quanh đây. Nhìn kỹ xung quanh nhé!"}
      </p>
    </figure>
  );
}

function shake(el: HTMLElement | null) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(
    [0, -7, 7, -5, 5, -2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 420, easing: "ease-out" },
  );
}

/** Bước 1 của màn: đọc gợi ý, gõ tên địa điểm vào cuống vé để kiểm tra */
function SolveStep({
  clue,
  onAnswer,
}: {
  clue: PublicClue;
  onAnswer: (answer: string) => Promise<string | null>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slotRef = useRef<HTMLLabelElement>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const err = await onAnswer(text);
    setBusy(false);
    if (err) {
      setError(err);
      shake(slotRef.current);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col items-center text-center" noValidate>
      <ClueCard clue={clue}>
        <label ref={slotRef} className={`lvl-answer ${error ? "is-wrong" : ""}`}>
          <input
            className="lvl-answer-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            aria-label="Tên địa điểm"
            maxLength={120}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-invalid={!!error}
            aria-describedby="answer-msg"
          />
        </label>
      </ClueCard>
      <p
        id="answer-msg"
        role={error ? "alert" : undefined}
        className={`lvl-status mt-4 ${error ? "is-wrong" : ""}`}
      >
        {error ?? "Đoán ra rồi thì gõ tên địa điểm vào chỗ trống để kiểm tra."}
      </p>
      <button className="btn btn-primary mt-5 w-full" disabled={busy || !text.trim()}>
        {busy ? <Spinner /> : "Kiểm tra địa điểm"}
      </button>
    </form>
  );
}

/** Màn đã xong: địa điểm (mở lại trên Google Maps), gợi ý ban đầu nếu có, lời nhắn của Ban tổ chức */
function DoneInfo({ c, onClose }: { c: CompletedStage; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Stars n={STARS_PER_LEVEL} className="lvl-popup-stars" big />
      <p className="mt-1 text-[14px] font-semibold text-muted">Đã tìm thấy</p>

      <div className="mt-5 w-full">
        <PlaceCard place={c.place} label="Địa điểm" mode="view" />
      </div>

      {/* Giữ lại gợi ý để xem cô ấy đã đoán ra từ đâu */}
      {c.clue?.text && (
        <div className="mt-5 w-full">
          <ClueCard clue={c.clue} />
        </div>
      )}

      {c.successMessage && (
        <figure className="mt-4 w-full rounded-3xl bg-[#fff1f7] px-4 py-3 text-left">
          <blockquote className="whitespace-pre-line text-[16px] leading-relaxed text-ink/90">
            {c.successMessage}
          </blockquote>
          <figcaption className="mt-1.5 text-[13px] font-medium text-muted">Ban tổ chức</figcaption>
        </figure>
      )}

      <button className="btn btn-ghost mt-5 w-full" onClick={onClose} autoFocus>
        Đóng
      </button>
    </div>
  );
}

/**
 * Màn đang chơi, theo bước:
 * solve — gợi ý + chỗ điền tên địa điểm; travel — điểm đến + chỉ đường;
 * search — đã tới nơi, gợi ý chỗ giấu mã QR + nút quét.
 */
function CurrentInfo({
  stage,
  near,
  geoStatus,
  onScan,
  onAnswer,
  onClose,
  onLocationHelp,
}: {
  stage: PublicStage;
  near: boolean;
  geoStatus: GeoStatus;
  onScan: () => void;
  onAnswer: (answer: string) => Promise<string | null>;
  onClose: () => void;
  onLocationHelp: () => void;
}) {
  if (stage.phase === "solve") return <SolveStep clue={stage.clue} onAnswer={onAnswer} />;

  if (stage.phase === "search") {
    return (
      <div className="flex flex-col items-center text-center">
        <QrHintCard hint={stage.qrHint} />
        <p className="lvl-status mt-4">Tìm thấy mã QR thì quét để mở màn tiếp theo.</p>
        <button className="btn btn-primary mt-5 w-full" onClick={onScan} autoFocus>
          <QrIcon /> Quét mã QR
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      {stage.place ? (
        <PlaceCard place={stage.place} label="Điểm đến" />
      ) : (
        <ClueCard clue={stage.clue} />
      )}
      {near ? (
        <p className="lvl-status is-near mt-4">Bạn đã vào vòng 1 km. Đang mở gợi ý tìm mã QR…</p>
      ) : (
        <p className="lvl-status mt-4">
          {NO_LOCATION.includes(geoStatus) ? (
            <>
              Bật vị trí để app biết khi bạn đến nơi.{" "}
              <button className="font-bold text-peri-deep underline" onClick={onLocationHelp}>
                Xem cách bật
              </button>
            </>
          ) : stage.place ? (
            "Đến trong vòng 1\u00a0km, gợi\u00a0ý tìm mã QR sẽ hiện ra."
          ) : (
            "Đoán xem đó là đâu rồi đi tới đó. Đến trong vòng 1\u00a0km, gợi\u00a0ý tìm mã QR sẽ hiện ra."
          )}
        </p>
      )}
      <button className="btn btn-primary mt-5 w-full" onClick={onClose} autoFocus>
        Lên đường thôi
      </button>
      <button className="mt-3 min-h-11 text-[15px] font-semibold text-peri-deep" onClick={onScan}>
        Thấy mã QR rồi? Quét ngay
      </button>
    </div>
  );
}

function Locked({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="lvl-popup-lock" aria-hidden="true">
        <LockIcon size={40} />
      </div>
      <h2 className="display-title mt-3 text-[24px]">{title}</h2>
      <p className="mt-2 text-[16px] leading-snug text-muted">{text}</p>
      <button className="btn btn-ghost mt-6 w-full" onClick={onClose} autoFocus>
        Đóng
      </button>
    </div>
  );
}

// ======================= Hình vẽ =======================

const STAR = "M12 2.6l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.6l-5.8 3.3 1.5-6.4-4.9-4.3 6.5-.6z";

function Stars({
  n,
  className = "",
  big = false,
}: {
  n: number;
  className?: string;
  big?: boolean;
}) {
  const s = big ? 40 : 18;
  return (
    <span className={`flex items-end ${className}`} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          width={i === 1 ? s * 1.25 : s}
          height={i === 1 ? s * 1.25 : s}
          viewBox="0 0 24 24"
          className={i === 1 ? "-mb-0.5" : ""}
          style={big ? { animationDelay: `${i * 120 + 150}ms` } : undefined}
        >
          <path
            d={STAR}
            fill={i < n ? "var(--butter)" : "#e4e1f5"}
            stroke={i < n ? "var(--grape)" : "#a9a3d4"}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {i < n && (
            <path d="M9 7.8l1.4-.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          )}
        </svg>
      ))}
    </span>
  );
}

function RestartIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M4 3.8v4.6h4.6"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QrIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect x="8" y="8" width="3" height="3" rx="0.6" fill="currentColor" />
      <rect x="13" y="8" width="3" height="3" rx="0.6" fill="currentColor" />
      <rect x="8" y="13" width="3" height="3" rx="0.6" fill="currentColor" />
      <path d="M13.5 13.5h2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <rect x="4.5" y="10" width="15" height="11" rx="3.5" fill="currentColor" />
      <circle cx="12" cy="15.5" r="1.7" fill="#fff" />
    </svg>
  );
}

/** Hai dây xích bắt chéo quanh màn + ổ khóa vàng. `breaking`: chạy hiệu ứng phá xích. */
function Chains({ breaking = false }: { breaking?: boolean }) {
  // Mỗi dây chia đôi để khi đứt thì hai nửa văng về hai phía
  const pieces = [
    { a: 45, from: 0, to: 4, dx: "-34px", dy: "30px", r: "-50deg" },
    { a: 45, from: 4, to: 8, dx: "36px", dy: "26px", r: "40deg" },
    { a: -45, from: 0, to: 4, dx: "34px", dy: "32px", r: "55deg" },
    { a: -45, from: 4, to: 8, dx: "-36px", dy: "24px", r: "-45deg" },
  ];
  return (
    <span className={`lvl-chains ${breaking ? "is-breaking" : ""}`} aria-hidden="true">
      <svg viewBox="-60 -60 120 120" className="lvl-chain-svg">
        {pieces.map((p, i) => (
          <g
            key={i}
            className="lvl-chain-piece"
            style={{
              ["--dx" as string]: p.dx,
              ["--dy" as string]: p.dy,
              ["--r" as string]: p.r,
            }}
          >
            <g transform={`rotate(${p.a})`}>
              {Array.from({ length: p.to - p.from }, (_, k) => {
                const x = -52 + (p.from + k) * 13.5;
                return (k + p.from) % 2 === 0 ? (
                  <g key={k}>
                    <rect
                      x={x - 8}
                      y={-5.5}
                      width={16}
                      height={11}
                      rx={5.5}
                      fill="none"
                      stroke="var(--grape)"
                      strokeWidth={5}
                    />
                    <rect
                      x={x - 8}
                      y={-5.5}
                      width={16}
                      height={11}
                      rx={5.5}
                      fill="none"
                      stroke="#e4e0f6"
                      strokeWidth={2.2}
                    />
                  </g>
                ) : (
                  <rect
                    key={k}
                    x={x - 8}
                    y={-2.4}
                    width={16}
                    height={4.8}
                    rx={2.4}
                    fill="#c9c3e8"
                    stroke="var(--grape)"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          </g>
        ))}
      </svg>
      <span className="lvl-padlock">
        <svg width="34" height="40" viewBox="0 0 34 40">
          <path
            className="lvl-shackle"
            d="M9 19v-7a8 8 0 0 1 16 0v7"
            fill="none"
            stroke="var(--grape)"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <path
            className="lvl-shackle"
            d="M9 19v-7a8 8 0 0 1 16 0v7"
            fill="none"
            stroke="#e4e0f6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <rect
            x="3"
            y="17"
            width="28"
            height="21"
            rx="6"
            fill="url(#lvl-lock-gold)"
            stroke="var(--grape)"
            strokeWidth="3"
          />
          <path d="M7 22h20" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
          <path
            d="M17 25.5a2.6 2.6 0 0 1 1.4 4.8V33h-2.8v-2.7A2.6 2.6 0 0 1 17 25.5z"
            fill="var(--grape)"
          />
          <defs>
            <linearGradient id="lvl-lock-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff3a6" />
              <stop offset="0.55" stopColor="var(--butter)" />
              <stop offset="1" stopColor="#f2b800" />
            </linearGradient>
          </defs>
        </svg>
      </span>
    </span>
  );
}

/** Lớp phủ khi màn vừa được mở: mặt "?" bị xích, xích đứt, kẹo nổ lấp lánh */
function UnlockFx() {
  return (
    <>
      <span className="lvl-burst" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} style={{ ["--a" as string]: `${i * 45 + 22}deg` }} />
        ))}
      </span>
      <span className="lvl-cover" aria-hidden="true">
        ?
      </span>
      <Chains breaking />
    </>
  );
}

function FinishBadge({ children }: { children?: ReactNode }) {
  return (
    <span className="relative block" aria-hidden="true">
      {/* Cờ ca-rô */}
      <svg
        className="lvl-flag absolute -top-[46px] left-1/2 -translate-x-[4px]"
        width="46"
        height="54"
        viewBox="0 0 46 54"
      >
        <path d="M4 3v50" stroke="var(--grape)" strokeWidth="4" strokeLinecap="round" />
        <path
          d="M6 5h34l-6 9 6 9H6z"
          fill="#fff"
          stroke="var(--grape)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M6 5h8v9H6zM22 5h8v9h-8zM14 14h8v9h-8zM30 14h6l3 4.5-1.5 4.5H30z"
          fill="var(--grape)"
        />
      </svg>
      <span className="lvl-finish-face">
        <svg width="40" height="40" viewBox="0 0 24 24">
          <path
            d={STAR}
            fill="#fff"
            stroke="var(--grape)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
        {children}
      </span>
    </span>
  );
}

function AvatarPin({ url, name }: { url: string | null; name: string }) {
  return (
    <span className="lvl-pin">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        <span className="lvl-pin-initial">{name.trim().charAt(0).toUpperCase() || "?"}</span>
      )}
    </span>
  );
}

/** Cảnh vật hai bên đường: đồi cỏ ở chân bản đồ, cây kẹo mút ở khúc cua, mây ở trên cao */
function Scenery({ pts, H, last }: { pts: Pt[]; H: number; last: number }) {
  const trees: { x: number; y: number; s: number; c: string }[] = [];
  const clouds: { x: number; y: number; s: number }[] = [];
  const tops = ["#ff8cba", "#9aa5ff", "#ffd84d", "#7fd6a8"];
  for (let i = 1; i < last; i++) {
    const p = pts[i];
    const right = p.x > W / 2;
    // Cây ở phía bên kia khúc cua, mây bay ở giữa hai màn
    trees.push({
      x: right ? 58 : 302,
      y: p.y + 14,
      s: 1,
      c: tops[i % tops.length],
    });
    trees.push({
      x: right ? 26 : 334,
      y: p.y + 52,
      s: 0.7,
      c: tops[(i + 2) % tops.length],
    });
    clouds.push({
      x: right ? 290 : 70,
      y: p.y - GAP / 2 - 6,
      s: 0.8 + (i % 2) * 0.25,
    });
  }
  const top = pts[last];
  return (
    <g>
      {/* Đồi ở chân bản đồ */}
      <path
        d={`M0 ${H - 150} Q 90 ${H - 215} 190 ${H - 165} T 360 ${H - 175} V ${H} H 0 Z`}
        fill="#c9efc0"
      />
      <path
        d={`M0 ${H - 90} Q 120 ${H - 150} 230 ${H - 100} T 360 ${H - 110} V ${H} H 0 Z`}
        fill="#a6e19a"
      />
      {/* Mây quanh đích */}
      <Cloud x={top.x - 110} y={top.y + 10} s={1.1} />
      <Cloud x={top.x + 112} y={top.y - 30} s={0.9} />
      {clouds.map((c, i) => (
        <Cloud key={i} {...c} />
      ))}
      {trees.map((t, i) => (
        <Lollipop key={i} {...t} />
      ))}
    </g>
  );
}

/** Biển mây che đoạn đường phía sau màn bí mật */
function FogBank({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* Lớp sương mờ dày dần lên trên, rồi các cụm mây phồng chồng lên nhau */}
      <rect x="-20" y={y - 110} width={W + 40} height="150" fill="url(#lvl-fog-fade)" />
      <defs>
        <linearGradient id="lvl-fog-fade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="lvl-fog">
        <Cloud x={x - 120} y={y + 30} s={1.3} />
        <Cloud x={x + 120} y={y + 22} s={1.25} />
        <Cloud x={x - 50} y={y + 12} s={1.5} />
        <Cloud x={x + 40} y={y + 4} s={1.7} />
        <Cloud x={x - 110} y={y - 40} s={1.4} />
        <Cloud x={x + 100} y={y - 48} s={1.45} />
        <Cloud x={x} y={y - 70} s={1.8} />
        <Cloud x={x - 2} y={y + 8} s={1.55} />
      </g>
    </g>
  );
}

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity="0.95">
      <path
        d="M-38 10 a16 16 0 0 1 10-24 a20 20 0 0 1 36-6 a15 15 0 0 1 26 10 a12 12 0 0 1 4 20 z"
        fill="#fff"
        stroke="#d7dbfb"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Lollipop({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="34" rx="16" ry="4.5" fill="rgba(46,15,82,0.12)" />
      <path d="M0 2v32" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M0 2v32"
        stroke="var(--grape)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="0.1 9"
        opacity="0.25"
      />
      <circle cx="0" cy="-8" r="19" fill={c} stroke="var(--grape)" strokeWidth="3" />
      <path
        d="M-11 -12 a12 12 0 0 1 9 -9"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </g>
  );
}
