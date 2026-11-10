"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/client/api";
import { celebrate, requestGeolocation, requestWakeLock } from "@/client/device";
import { sfx, unlockAudio } from "@/client/sound";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversine } from "@/lib/geo";
import { NEAR_RADIUS_M, type CompletedStage, type GameState, type ScanResult } from "@/lib/types";
import { ArrivedDialog, GameMap, type MapIntro } from "./GameMap";
import { LocationHelpSheet } from "./LocationHelpSheet";
import { LoginScreen } from "./LoginScreen";
import { ReviewSheet } from "./ReviewSheet";
import { ScanSheet } from "./ScanSheet";
import { SuccessSheet } from "./SuccessSheet";
import { Spinner, StatusScreen } from "./ui";
import { WelcomeScreen } from "./WelcomeScreen";

type Phase = "loading" | "login" | "ready" | "offline" | "unregistered";
type SheetKind = null | "scan" | "review" | "success" | "location";

const PENDING_SCAN_KEY = "rm_pending_scan";
/** Đã báo "đến nơi" cho chặng nào (không báo lại khi mở lại app) */
const ARRIVED_KEY = "rm_arrived";

function storage(kind: "session" | "local" = "session") {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function loadArrived(): number[] {
  try {
    const v = JSON.parse(storage("local")?.getItem(ARRIVED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export default function Game() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [phaseMessage, setPhaseMessage] = useState("");
  const [state, setState] = useState<GameState | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [review, setReview] = useState<CompletedStage | null>(null);
  const [success, setSuccess] = useState<{ order: number; message: string; next: GameState } | null>(
    null,
  );
  const [scanError, setScanError] = useState<string | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [mapIntro, setMapIntro] = useState<MapIntro | null>(null);
  const [arrivedShown, setArrivedShown] = useState<number[]>(() =>
    typeof window === "undefined" ? [] : loadArrived(),
  );
  const gestureDone = useRef(false);

  const applyState = useCallback((s: GameState) => setState(s), []);

  const handleAuthError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      setPhase("login");
      return true;
    }
    if (e instanceof ApiError && e.status === 403) {
      setPhaseMessage(e.message);
      setPhase("unregistered");
      return true;
    }
    return false;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await api<GameState>("/api/state");
      applyState(s);
      setOnline(true);
      setPhase("ready");
    } catch (e) {
      if (handleAuthError(e)) return;
      if (e instanceof ApiError && e.offline) setOnline(false);
      // Đã có dữ liệu thì giữ nguyên màn hình; chưa có thì báo mất sóng
      setPhase((p) => (p === "ready" ? p : "offline"));
      setPhaseMessage(e instanceof ApiError ? e.message : "Có lỗi xảy ra.");
    }
  }, [applyState, handleAuthError]);

  // --- Khởi động: đọc mã QR từ link (/q/<token> chuyển về /?scan=<token>) ---
  useEffect(() => {
    const url = new URL(window.location.href);
    const scan = url.searchParams.get("scan");
    if (scan) {
      storage()?.setItem(PENDING_SCAN_KEY, scan);
      url.searchParams.delete("scan");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    // refresh() chỉ đổi state sau khi có phản hồi từ server
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // --- Mở lại tab / có mạng lại: lấy trạng thái mới từ server ---
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        void requestWakeLock();
      }
    };
    const onOnline = () => {
      setOnline(true);
      void refresh();
    };
    const onOffline = () => setOnline(false);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  const status = state?.status;
  const racing = phase === "ready" && status === "traveling";

  // --- Mở lại trang khi đã đang đua: cú chạm đầu tiên dùng để bật âm thanh, giữ màn hình ---
  useEffect(() => {
    if (!racing) return;
    void requestWakeLock();
    if (gestureDone.current) return;
    const once = () => {
      if (gestureDone.current) return;
      gestureDone.current = true;
      unlockAudio();
      void requestWakeLock();
    };
    document.addEventListener("touchend", once, { once: true });
    document.addEventListener("click", once, { once: true });
    return () => {
      document.removeEventListener("touchend", once);
      document.removeEventListener("click", once);
    };
  }, [racing]);

  // --- Vị trí: theo dõi ngầm, chỉ để biết đã vào bán kính 1 km quanh điểm bí mật chưa ---
  const { fix, status: geoStatus } = useGeolocation(racing);
  const stage = state?.stage ?? null;
  const near = useMemo(
    () => !!(fix && stage && haversine(fix, stage) <= NEAR_RADIUS_M),
    [fix, stage],
  );
  // Báo "đến nơi" một lần cho mỗi chặng; không chen vào lúc đang chạy hiệu ứng hay đang mở bảng khác
  const showArrived =
    racing && near && !!stage && !arrivedShown.includes(stage.order) && sheet === null && !mapIntro;
  const dismissArrived = useCallback(() => {
    if (!stage) return;
    setArrivedShown((prev) => {
      const next = [...new Set([...prev, stage.order])];
      storage("local")?.setItem(ARRIVED_KEY, JSON.stringify(next));
      return next;
    });
  }, [stage]);
  useEffect(() => {
    if (!showArrived) return;
    sfx.arrive();
    try {
      navigator.vibrate?.([120, 80, 120]);
    } catch {
      /* máy không rung được thì thôi */
    }
  }, [showArrived]);

  // --- Quét mã: đúng mã của chặng đang chơi là qua màn ---
  const submitScan = useCallback(
    async (input: { token?: string; code?: string }): Promise<string | null> => {
      try {
        const r = await api<ScanResult>("/api/scan", input);
        if (!r.ok) {
          sfx.wrong();
          return r.message;
        }
        setScanError(null);
        if (r.kind === "review") {
          sfx.scan();
          applyState(r.state);
          setReview(r.stage);
          setSheet("review");
          return null;
        }
        sfx.success();
        void celebrate();
        setSuccess({ order: r.order, message: r.successMessage, next: r.state });
        setSheet("success");
        return null;
      } catch (e) {
        if (handleAuthError(e)) return null;
        return e instanceof ApiError ? e.message : "Có lỗi xảy ra, thử lại nhé.";
      }
    },
    [applyState, handleAuthError],
  );

  // Mã QR mở bằng app Camera: xử lý sau khi đã đăng nhập và đã bắt đầu
  useEffect(() => {
    if (!racing && status !== "finished") return;
    const pending = storage()?.getItem(PENDING_SCAN_KEY);
    if (!pending) return;
    storage()?.removeItem(PENDING_SCAN_KEY);
    // submitScan() chỉ đổi state sau khi có phản hồi từ server
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void submitScan({ token: pending }).then((err) => {
      if (err) {
        setScanError(err);
        setSheet("scan");
      }
    });
  }, [racing, status, submitScan]);

  // --- Bắt đầu cuộc đua: cú chạm này bật âm thanh, xin quyền vị trí, giữ màn hình sáng ---
  const start = useCallback(async () => {
    gestureDone.current = true;
    unlockAudio();
    requestGeolocation(); // mở prompt quyền vị trí (iOS) — không chặn chờ kết quả
    void requestWakeLock();
    try {
      const s = await api<GameState>("/api/start", {});
      // Vào bản đồ màn chơi và mở ngay gợi ý của màn 1
      setMapIntro({ from: null, open: s.stage?.order ?? 1 });
      applyState(s);
      sfx.scan();
    } catch (e) {
      if (handleAuthError(e)) return;
      alert(e instanceof ApiError ? e.message : "Có lỗi xảy ra, thử lại nhé.");
    }
  }, [applyState, handleAuthError]);

  const openScan = useCallback(() => {
    setScanError(null);
    setSheet("scan");
  }, []);

  // ================= Hiển thị =================

  if (phase === "loading") {
    return (
      <main className="app-screen sky grid place-items-center text-accent">
        <Spinner className="h-8 w-8" />
      </main>
    );
  }

  if (phase === "login") {
    return (
      <LoginScreen
        onLoggedIn={() => {
          setPhase("loading");
          void refresh();
        }}
      />
    );
  }

  if (phase === "offline") {
    return (
      <StatusScreen
        icon="📶"
        title="Mất kết nối"
        body={
          <>
            {phaseMessage || "Không kết nối được máy chủ."} Tiến trình của bạn vẫn được lưu an toàn.
          </>
        }
        action={
          <button className="btn btn-primary w-full" onClick={() => void refresh()}>
            Thử lại
          </button>
        }
      />
    );
  }

  if (phase === "unregistered") {
    return (
      <StatusScreen
        icon="🎟️"
        title="Chưa có vé tham gia"
        body={phaseMessage || "Tài khoản này chưa được ghi danh. Hãy liên hệ Ban tổ chức nhé."}
        action={
          <button
            className="btn btn-ghost w-full"
            onClick={async () => {
              await api("/api/logout", {}).catch(() => {});
              setPhase("login");
            }}
          >
            Đăng nhập tài khoản khác
          </button>
        }
      />
    );
  }

  if (!state) return null;

  if (state.status === "not_started") {
    return (
      <WelcomeScreen
        name={state.player.displayName}
        avatarUrl={state.player.avatarUrl}
        onStart={start}
      />
    );
  }

  // Trong lúc hiện bảng "Tìm thấy rồi!" vẫn giữ bản đồ cũ; bấm tiếp mới sang màn mới (chạy hiệu ứng phá xích)
  const finished = state.status === "finished";
  return (
    <>
      <GameMap
        // Sang màn mới / về đích thì dựng lại bản đồ để chạy hiệu ứng phá xích
        key={finished ? "finish" : state.stage?.order}
        state={state}
        near={near}
        geoStatus={geoStatus}
        online={online}
        intro={mapIntro}
        onIntroDone={() => setMapIntro(null)}
        onScan={openScan}
        onLocationHelp={() => setSheet("location")}
      />

      {showArrived && (
        <ArrivedDialog
          onScan={() => {
            dismissArrived();
            openScan();
          }}
          onClose={dismissArrived}
        />
      )}

      {sheet === "scan" && (
        <ScanSheet
          stageOrder={state.stage?.order ?? null}
          onSubmit={submitScan}
          onClose={() => setSheet(null)}
          initialError={scanError}
        />
      )}

      {sheet === "review" && review && (
        <ReviewSheet stage={review} onClose={() => setSheet(null)} />
      )}

      {sheet === "success" && success && (
        <SuccessSheet
          order={success.order}
          message={success.message}
          isLast={success.next.status === "finished"}
          onContinue={() => {
            const next = success.next;
            // Về bản đồ màn chơi: xích của màn mới (hoặc đích) đứt, avatar nhảy sang, rồi mở gợi ý màn mới
            setMapIntro({ from: success.order, open: next.stage?.order ?? null });
            setSuccess(null);
            setSheet(null);
            applyState(next);
          }}
        />
      )}

      {sheet === "location" && <LocationHelpSheet onClose={() => setSheet(null)} />}
    </>
  );
}
