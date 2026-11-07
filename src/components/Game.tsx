"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/client/api";
import {
  celebrate,
  requestCompassPermission,
  requestGeolocation,
  requestWakeLock,
} from "@/client/device";
import { sfx, unlockAudio } from "@/client/sound";
import { useCompass } from "@/hooks/useCompass";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { AnswerResult, GameState, PublicPuzzle, ScanResult } from "@/lib/types";
import { FinishScreen } from "./FinishScreen";
import { LocationHelpSheet } from "./LocationHelpSheet";
import { LoginScreen } from "./LoginScreen";
import { PuzzleSheet, type AnswerOutcome } from "./PuzzleSheet";
import { RaceScreen } from "./RaceScreen";
import { ScanSheet } from "./ScanSheet";
import { SuccessSheet } from "./SuccessSheet";
import { Spinner, StatusScreen } from "./ui";
import { WelcomeScreen } from "./WelcomeScreen";

type Phase = "loading" | "login" | "ready" | "offline" | "unregistered";
type SheetKind = null | "scan" | "puzzle" | "view" | "success" | "location";

const PENDING_SCAN_KEY = "rm_pending_scan";
/** Khi xe chạy nhanh hơn ~2 m/s thì lấy hướng từ GPS, còn lại lấy từ la bàn (mục 6b) */
const GPS_HEADING_MIN_SPEED = 2;

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export default function Game() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [phaseMessage, setPhaseMessage] = useState("");
  const [state, setState] = useState<GameState | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [puzzle, setPuzzle] = useState<PublicPuzzle | null>(null);
  const [success, setSuccess] = useState<{ order: number; message: string; next: GameState } | null>(
    null,
  );
  const [scanError, setScanError] = useState<string | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [justFinished, setJustFinished] = useState(false);
  const gestureDone = useRef(false);
  const sheetRef = useRef<SheetKind>(null);
  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  const applyState = useCallback((s: GameState) => {
    setState(s);
    setClockOffset(new Date(s.serverNow).getTime() - Date.now());
    if (s.status === "solving" && s.puzzle) {
      setPuzzle(s.puzzle);
      // Mở lại đúng câu đố khi quay lại tab
      if (sheetRef.current === null) setSheet("puzzle");
    }
  }, []);

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
  const racing = phase === "ready" && (status === "traveling" || status === "solving");

  // --- Mở lại trang khi đã đang đua: cú chạm đầu tiên dùng để bật âm thanh, la bàn, giữ màn hình ---
  useEffect(() => {
    if (!racing) return;
    void requestWakeLock();
    if (gestureDone.current) return;
    const once = () => {
      if (gestureDone.current) return;
      gestureDone.current = true;
      unlockAudio();
      void requestCompassPermission();
      void requestWakeLock();
    };
    document.addEventListener("touchend", once, { once: true });
    document.addEventListener("click", once, { once: true });
    return () => {
      document.removeEventListener("touchend", once);
      document.removeEventListener("click", once);
    };
  }, [racing]);

  // --- Vị trí và hướng ---
  const { fix, status: geoStatus } = useGeolocation(racing);
  const compass = useCompass(racing);
  const heading =
    fix?.heading != null && (fix.speed ?? 0) > GPS_HEADING_MIN_SPEED ? fix.heading : compass;

  // --- Chặng 1 chưa có đường (lúc bấm "Bắt đầu" chưa có vị trí): tính khi có vị trí ---
  const routeRequested = useRef(false);
  useEffect(() => {
    if (!racing || !fix || routeRequested.current) return;
    if (state?.stage?.order !== 1 || state.stage.route) return;
    routeRequested.current = true;
    api<GameState>("/api/route", { lat: fix.lat, lng: fix.lng })
      .then(applyState)
      .catch(() => {
        routeRequested.current = false;
      });
  }, [racing, fix, state, applyState]);

  // --- Quét mã ---
  const submitScan = useCallback(
    async (input: { token?: string; code?: string }): Promise<string | null> => {
      try {
        const r = await api<ScanResult>("/api/scan", input);
        if (r.ok) {
          sfx.scan();
          applyState(r.state);
          setPuzzle(r.puzzle);
          setScanError(null);
          setSheet(r.puzzle.readOnly ? "view" : "puzzle");
          return null;
        }
        sfx.wrong();
        return r.message;
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

  // --- Trả lời ---
  const submitAnswer = useCallback(
    async (answer: string): Promise<AnswerOutcome> => {
      try {
        const r = await api<AnswerResult>("/api/answer", { answer });
        if (!r.ok) {
          if (r.state) applyState(r.state);
          if (r.reason === "not_scanned") setSheet(null);
          return { error: r.message };
        }
        if (r.correct) {
          sfx.success();
          void celebrate();
          setSuccess({ order: puzzle?.order ?? 0, message: r.successMessage, next: r.state });
          setSheet("success");
          return null;
        }
        sfx.wrong();
        setPuzzle(r.puzzle);
        return {
          error: r.newHint ? `${r.message} Ban tổ chức vừa gửi thêm một gợi ý.` : r.message,
          newHint: r.newHint,
        };
      } catch (e) {
        if (handleAuthError(e)) return null;
        return { error: e instanceof ApiError ? e.message : "Có lỗi xảy ra, thử lại nhé." };
      }
    },
    [applyState, handleAuthError, puzzle],
  );

  // --- Bắt đầu cuộc đua: cú chạm này xin quyền la bàn, bật âm thanh, giữ màn hình sáng ---
  // Không chặn chờ GPS: tuyến chặng 1 sẽ tính sau khi có vị trí (useEffect bên dưới).
  const start = useCallback(async () => {
    gestureDone.current = true;
    unlockAudio();
    const compassP = requestCompassPermission(); // phải gọi ngay trong cú chạm
    requestGeolocation(); // mở prompt quyền vị trí (iOS) — không chặn chờ kết quả
    void requestWakeLock();
    void compassP;
    try {
      const s = await api<GameState>("/api/start", {});
      applyState(s);
      sfx.scan();
    } catch (e) {
      if (handleAuthError(e)) return;
      alert(e instanceof ApiError ? e.message : "Có lỗi xảy ra, thử lại nhé.");
    }
  }, [applyState, handleAuthError]);

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

  if (state.status === "finished" && sheet !== "success") {
    return (
      <>
        <FinishScreen
          startedAt={state.player.startedAt}
          finishedAt={state.player.finishedAt}
          fresh={justFinished}
        />
        {sheet === "view" && puzzle && (
          <PuzzleSheet puzzle={puzzle} onClose={() => setSheet(null)} />
        )}
      </>
    );
  }

  if (state.status === "not_started") {
    return (
      <WelcomeScreen
        name={state.player.displayName}
        avatarUrl={state.player.avatarUrl}
        onStart={start}
      />
    );
  }

  return (
    <>
      {state.stage && (
        <RaceScreen
          state={state}
          clockOffsetMs={clockOffset}
          fix={fix}
          geoStatus={geoStatus}
          heading={heading}
          online={online}
          onScan={() => {
            setScanError(null);
            setSheet("scan");
          }}
          onOpenPuzzle={() => setSheet("puzzle")}
          onLocationHelp={() => setSheet("location")}
        />
      )}

      {sheet === "scan" && state.stage && (
        <ScanSheet
          stageOrder={state.stage.order}
          onSubmit={submitScan}
          onClose={() => setSheet(null)}
          initialError={scanError}
        />
      )}

      {(sheet === "puzzle" || sheet === "view") && puzzle && (
        <PuzzleSheet
          puzzle={puzzle}
          onAnswer={sheet === "puzzle" && !puzzle.readOnly ? submitAnswer : undefined}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "success" && success && (
        <SuccessSheet
          order={success.order}
          message={success.message}
          isLast={success.next.status === "finished"}
          onContinue={() => {
            const next = success.next;
            if (next.status === "finished") setJustFinished(true);
            setSuccess(null);
            setPuzzle(null);
            setSheet(null);
            sheetRef.current = null;
            applyState(next);
          }}
        />
      )}

      {sheet === "location" && <LocationHelpSheet onClose={() => setSheet(null)} />}
    </>
  );
}
