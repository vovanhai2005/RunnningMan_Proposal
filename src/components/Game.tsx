"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/client/api";
import { celebrate, requestGeolocation, requestWakeLock } from "@/client/device";
import { sfx, unlockAudio } from "@/client/sound";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversine } from "@/lib/geo";
import {
  NEAR_RADIUS_M,
  type AnswerResult,
  type ArriveResult,
  type CompletedStage,
  type GameState,
  type PublicStage,
  type QuizResult,
  type ScanResult,
} from "@/lib/types";
import { ArrivedDialog, CandyDialog, GameMap, type MapIntro } from "./GameMap";
import { QuizStep } from "./Quiz";
import { LocationHelpSheet } from "./LocationHelpSheet";
import { MemoryReel } from "./MemoryReel";
import { ReviewSheet } from "./ReviewSheet";
import { ScanSheet } from "./ScanSheet";
import { SolvedSheet } from "./SolvedSheet";
import { SuccessSheet } from "./SuccessSheet";
import { Spinner, StatusScreen } from "./ui";
import { WelcomeScreen } from "./WelcomeScreen";

type Phase = "loading" | "ready" | "offline" | "unregistered";
type SheetKind =
  | null
  | "scan"
  | "review"
  | "memories"
  | "success"
  | "solved"
  | "arrived"
  | "quiz"
  | "location";

const PENDING_SCAN_KEY = "rm_pending_scan";
/** Báo server "đã tới nơi" thất bại (mất sóng, GPS lệch) thì chờ chừng này rồi thử lại */
const ARRIVE_RETRY_MS = 15_000;

function storage(kind: "session" | "local" = "session") {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
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
  /** Màn vừa đoán đúng địa điểm: hiện điểm đến vừa lộ */
  const [solved, setSolved] = useState<PublicStage | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  /** Ảnh kỷ niệm đang mở. `unlock`: vừa quét được mã, xem xong thì sang bảng "Tìm thấy rồi!" */
  const [reel, setReel] = useState<{ stage: CompletedStage; unlock: boolean } | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [mapIntro, setMapIntro] = useState<MapIntro | null>(null);
  /** Lần gần nhất báo server "đã tới nơi" (để không gọi dồn dập theo từng lần GPS cập nhật) */
  const arriveTry = useRef<{ order: number; at: number } | null>(null);
  const gestureDone = useRef(false);

  const applyState = useCallback((s: GameState) => setState(s), []);

  /** Chưa tạo người chơi nào trên server (không có đăng nhập nên chỉ còn trường hợp này) */
  const handleAuthError = useCallback((e: unknown) => {
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

  // --- Vị trí: theo dõi ngầm, chỉ để biết đã vào bán kính 1 km quanh điểm đến chưa ---
  const { fix, status: geoStatus } = useGeolocation(racing);
  const stage = state?.stage ?? null;
  const near = useMemo(
    () => !!(fix && stage?.target && haversine(fix, stage.target) <= NEAR_RADIUS_M),
    [fix, stage],
  );

  // Vào vòng 1 km: báo server (server tự đo lại) để lộ gợi ý chỗ giấu mã QR.
  // Không chen vào lúc đang chạy hiệu ứng hay đang mở bảng khác.
  const canArrive = racing && near && stage?.phase === "travel" && sheet === null && !mapIntro;
  useEffect(() => {
    if (!canArrive || !fix || !stage) return;
    const last = arriveTry.current;
    if (last && last.order === stage.order && Date.now() - last.at < ARRIVE_RETRY_MS) return;
    arriveTry.current = { order: stage.order, at: Date.now() };
    void api<ArriveResult>("/api/arrive", { lat: fix.lat, lng: fix.lng })
      .then((r) => {
        if (!r.ok) return;
        applyState(r.state);
        sfx.arrive();
        try {
          navigator.vibrate?.([120, 80, 120]);
        } catch {
          /* máy không rung được thì thôi */
        }
        setSheet("arrived");
      })
      .catch((e) => {
        handleAuthError(e);
      });
  }, [canArrive, fix, stage, applyState, handleAuthError]);

  // --- Gõ tên địa điểm: đúng thì lộ điểm đến; trả về lời báo sai hoặc null ---
  const submitAnswer = useCallback(
    async (answer: string): Promise<string | null> => {
      try {
        const r = await api<AnswerResult>("/api/answer", { answer });
        if (!r.ok) return r.message;
        if (!r.correct) {
          sfx.wrong();
          return r.message;
        }
        sfx.success();
        void celebrate();
        applyState(r.state);
        setSolved(r.state.stage);
        setSheet("solved");
        return null;
      } catch (e) {
        if (handleAuthError(e)) return null;
        return e instanceof ApiError ? e.message : "Có lỗi xảy ra, thử lại nhé.";
      }
    },
    [applyState, handleAuthError],
  );

  /** Vừa hoàn thành một chặng (quét mã, hoặc trả lời đúng câu hỏi cuối): ảnh kỷ niệm → chúc mừng */
  const showCompleted = useCallback((order: number, message: string, next: GameState) => {
    sfx.success();
    void celebrate();
    setSuccess({ order, message, next });
    const done = next.completed.find((c) => c.order === order);
    if (done && done.memories.length > 0) {
      setReel({ stage: done, unlock: true });
      setSheet("memories");
    } else {
      setSheet("success");
    }
  }, []);

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
        if (r.kind === "quiz") {
          // Chặng cuối: quét xong còn một câu hỏi
          sfx.scan();
          applyState(r.state);
          setSheet("quiz");
          return null;
        }
        // Phần thưởng của chặng: ảnh kỷ niệm hiện ngay, xem xong mới tới bảng chúc mừng
        showCompleted(r.order, r.successMessage, r.state);
        return null;
      } catch (e) {
        if (handleAuthError(e)) return null;
        return e instanceof ApiError ? e.message : "Có lỗi xảy ra, thử lại nhé.";
      }
    },
    [applyState, handleAuthError, showCompleted],
  );

  // --- Câu hỏi sau khi quét mã: đúng là hoàn thành chặng ---
  const submitQuiz = useCallback(
    async (answer: string): Promise<string | null> => {
      try {
        const r = await api<QuizResult>("/api/quiz", { answer });
        if (!r.ok) return r.message;
        if (!r.correct) {
          sfx.wrong();
          return r.message;
        }
        showCompleted(r.order, r.successMessage, r.state);
        return null;
      } catch (e) {
        if (handleAuthError(e)) return null;
        return e instanceof ApiError ? e.message : "Có lỗi xảy ra, thử lại nhé.";
      }
    },
    [handleAuthError, showCompleted],
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

  // --- Chơi lại từ đầu: xóa tiến độ trên server và những gì app nhớ trên máy ---
  const reset = useCallback(async () => {
    try {
      const s = await api<GameState>("/api/reset", {});
      storage()?.removeItem(PENDING_SCAN_KEY);
      arriveTry.current = null;
      setMapIntro(null);
      setSuccess(null);
      setSolved(null);
      setReview(null);
      setReel(null);
      setSheet(null);
      applyState(s);
    } catch (e) {
      if (handleAuthError(e)) return;
      alert(e instanceof ApiError ? e.message : "Chưa xóa được, thử lại nhé.");
    }
  }, [applyState, handleAuthError]);

  // --- Trạm nghỉ: "Nghỉ xong, lên đường" mở chặng ngay sau trạm (chạy hiệu ứng phá xích) ---
  const finishRest = useCallback(async (): Promise<string | null> => {
    try {
      const s = await api<GameState>("/api/rest", {});
      const order = s.stage?.order;
      if (order != null) setMapIntro({ from: order - 0.5, open: order });
      sfx.scan();
      applyState(s);
      return null;
    } catch (e) {
      if (handleAuthError(e)) return null;
      return e instanceof ApiError ? e.message : "Có lỗi xảy ra, thử lại nhé.";
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
        body={phaseMessage || "Cuộc đua chưa có người chơi. Hãy liên hệ Ban tổ chức."}
        action={
          <button className="btn btn-ghost w-full" onClick={() => void refresh()}>
            Thử lại
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
        // Nghỉ xong ở trạm nghỉ cũng dựng lại để phá xích màn sau trạm
        key={finished ? "finish" : `${state.stage?.order}${state.stage?.phase === "rest" ? "-rest" : ""}`}
        state={state}
        near={near}
        geoStatus={geoStatus}
        online={online}
        intro={mapIntro}
        onIntroDone={() => setMapIntro(null)}
        onScan={openScan}
        onAnswer={submitAnswer}
        onLocationHelp={() => setSheet("location")}
        onReset={reset}
        onMemories={(stage) => setReel({ stage, unlock: false })}
        onRest={finishRest}
        onQuiz={submitQuiz}
        onRefresh={refresh}
      />

      {sheet === "arrived" && stage?.phase === "search" && (
        <ArrivedDialog hint={stage.qrHint ?? ""} onScan={openScan} onClose={() => setSheet(null)} />
      )}

      {sheet === "solved" && solved?.place && (
        <SolvedSheet
          order={solved.order}
          place={solved.place}
          onClose={() => {
            setSolved(null);
            setSheet(null);
          }}
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
        <ReviewSheet
          stage={review}
          onClose={() => setSheet(null)}
          onMemories={() => setReel({ stage: review, unlock: false })}
        />
      )}

      {sheet === "success" && success && (
        <SuccessSheet
          order={success.order}
          message={success.message}
          next={success.next.stage}
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

      {sheet === "quiz" && stage?.phase === "quiz" && stage.quiz && (
        <CandyDialog heading={`Nhiệm vụ ${stage.order}`} onClose={() => setSheet(null)} z="z-50">
          <QuizStep
            quiz={stage.quiz}
            serverNow={state.serverNow}
            onAnswer={submitQuiz}
            onHintDue={refresh}
          />
        </CandyDialog>
      )}

      {sheet === "location" && <LocationHelpSheet onClose={() => setSheet(null)} />}

      {reel && (
        <MemoryReel
          key={`${reel.stage.order}-${reel.unlock}`}
          stage={reel.stage}
          unlock={reel.unlock}
          onDone={() => {
            setReel(null);
            if (reel.unlock) setSheet("success");
          }}
        />
      )}
    </>
  );
}
