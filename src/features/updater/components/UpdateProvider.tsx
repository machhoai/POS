"use client";

import { isTauri } from "@tauri-apps/api/core";
import { AlertTriangle, Download, RefreshCw, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { useCartStore } from "@/lib/stores/useCartStore";

type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "installing"
  | "error"
  | "unsupported";

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string | null;
  availableVersion: string | null;
  notes: string | null;
  publishedAt: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  error: string | null;
  isStartupUpdateRequired: boolean;
}

interface UpdateContextValue extends UpdateState {
  progressPercent: number | null;
  checkForUpdates: (silent?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
  dismissPrompt: () => void;
}

interface UpdateProviderProps {
  children: ReactNode;
}

const INITIAL_STATE: UpdateState = {
  status: "idle",
  currentVersion: null,
  availableVersion: null,
  notes: null,
  publishedAt: null,
  downloadedBytes: 0,
  totalBytes: null,
  error: null,
  isStartupUpdateRequired: false,
};

type UpdateCheckOrigin = "startup" | "background" | "manual";

const STARTUP_UPDATE_DELAY_MS = 1_000;
const BACKGROUND_UPDATE_INTERVAL_MS = 15 * 60 * 1_000;

const UpdateContext = createContext<UpdateContextValue | null>(null);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Không thể kết nối tới máy chủ cập nhật.";

const UpdateProvider: React.FC<UpdateProviderProps> = ({ children }) => {
  const [state, setState] = useState<UpdateState>(INITIAL_STATE);
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const pendingUpdateRef = useRef<Update | null>(null);
  const isCheckingRef = useRef(false);

  const runUpdateCheck = useCallback(async (
    origin: UpdateCheckOrigin,
    silent: boolean,
  ): Promise<void> => {
    if (isCheckingRef.current) return;
    if (origin === "background" && pendingUpdateRef.current) return;

    if (!isTauri()) {
      setState((current) => ({ ...current, status: "unsupported", error: null }));
      return;
    }

    isCheckingRef.current = true;
    setState((current) => ({ ...current, status: "checking", error: null }));

    try {
      const [{ getVersion }, { check }] = await Promise.all([
        import("@tauri-apps/api/app"),
        import("@tauri-apps/plugin-updater"),
      ]);
      const currentVersion = await getVersion();
      setState((current) => ({ ...current, currentVersion }));
      const update = await check({ timeout: 30_000 });

      pendingUpdateRef.current = update;
      if (!update) {
        setState({
          ...INITIAL_STATE,
          status: "up-to-date",
          currentVersion,
        });
        if (!silent) setIsPromptVisible(false);
        return;
      }

      setState((current) => ({
        ...INITIAL_STATE,
        status: "available",
        currentVersion,
        availableVersion: update.version,
        notes: update.body?.trim() || null,
        publishedAt: update.date || null,
        isStartupUpdateRequired:
          origin === "startup" || current.isStartupUpdateRequired,
      }));
      setIsPromptVisible(true);
    } catch (error: unknown) {
      console.error("[Updater] Không thể kiểm tra cập nhật:", error);
      setState((current) => ({
        ...current,
        status: "error",
        error: errorMessage(error),
      }));
      if (silent) setIsPromptVisible(false);
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  const checkForUpdates = useCallback(async (silent = false): Promise<void> => {
    await runUpdateCheck("manual", silent);
  }, [runUpdateCheck]);

  const installUpdate = useCallback(async (): Promise<void> => {
    const update = pendingUpdateRef.current;
    if (!update) {
      setState((current) => ({
        ...current,
        status: "error",
        error: "Bản cập nhật không còn khả dụng. Vui lòng kiểm tra lại.",
      }));
      return;
    }

    const cart = useCartStore.getState();
    if (
      !state.isStartupUpdateRequired && (
        cart.isCheckingOut ||
        cart.isPaymentLocked ||
        cart.checkoutCheckpoint === "PAYMENT_INITIATED"
      )
    ) {
      setState((current) => ({
        ...current,
        error: "Hãy hoàn tất hoặc hủy giao dịch đang xử lý trước khi cập nhật JPOS.",
      }));
      setIsPromptVisible(true);
      return;
    }

    setState((current) => ({
      ...current,
      status: "downloading",
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
    }));

    let downloadedBytes = 0;
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          setState((current) => ({
            ...current,
            totalBytes: event.data.contentLength ?? null,
          }));
          return;
        }

        if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          setState((current) => ({ ...current, downloadedBytes }));
          return;
        }

        setState((current) => ({ ...current, status: "installing" }));
      }, { timeout: 120_000 });

      setState((current) => ({ ...current, status: "installing" }));
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error: unknown) {
      console.error("[Updater] Không thể cài đặt cập nhật:", error);
      setState((current) => ({
        ...current,
        status: "available",
        error: errorMessage(error),
      }));
      setIsPromptVisible(true);
    }
  }, [state.isStartupUpdateRequired]);

  const dismissPrompt = useCallback(() => {
    if (state.isStartupUpdateRequired) return;
    setIsPromptVisible(false);
  }, [state.isStartupUpdateRequired]);

  useEffect(() => {
    if (window.location.pathname.startsWith("/display")) return;
    const startupTimeoutId = window.setTimeout(() => {
      void runUpdateCheck("startup", true);
    }, STARTUP_UPDATE_DELAY_MS);
    const backgroundIntervalId = window.setInterval(() => {
      void runUpdateCheck("background", true);
    }, BACKGROUND_UPDATE_INTERVAL_MS);
    return () => {
      window.clearTimeout(startupTimeoutId);
      window.clearInterval(backgroundIntervalId);
    };
  }, [runUpdateCheck]);

  const progressPercent = useMemo(() => {
    if (!state.totalBytes || state.totalBytes <= 0) return null;
    return Math.min(100, Math.round((state.downloadedBytes / state.totalBytes) * 100));
  }, [state.downloadedBytes, state.totalBytes]);

  const value = useMemo<UpdateContextValue>(() => ({
    ...state,
    progressPercent,
    checkForUpdates,
    installUpdate,
    dismissPrompt,
  }), [checkForUpdates, dismissPrompt, installUpdate, progressPercent, state]);

  const isBusy = state.status === "downloading" || state.status === "installing";
  const isMandatory = state.isStartupUpdateRequired;

  return (
    <UpdateContext.Provider value={value}>
      {children}
      {isPromptVisible && state.availableVersion && (
        <aside
          role={isMandatory ? "dialog" : undefined}
          aria-modal={isMandatory ? true : undefined}
          aria-live="polite"
          className={isMandatory
            ? "fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            : "fixed bottom-5 right-5 z-[120] w-[min(390px,calc(100vw-2.5rem))] rounded-3xl border border-orange-100 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
          }
        >
          <div className={isMandatory
            ? "w-full max-w-md rounded-3xl border border-orange-100 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.36)]"
            : undefined
          }>
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[var(--color-accent)]">
              <Download className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-extrabold text-[var(--color-text-primary)]">
                {isMandatory
                  ? `Cần cập nhật JPOS ${state.availableVersion}`
                  : `JPOS ${state.availableVersion} đã sẵn sàng`}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                {isMandatory
                  ? "Bạn cần cài bản mới để tiếp tục sử dụng JPOS. Bản cập nhật đã được xác thực chữ ký."
                  : "Ứng dụng sẽ tải bản cập nhật đã ký, cài đặt và khởi động lại."}
              </p>
            </div>
            {!isMandatory && !isBusy && (
              <button
                type="button"
                onClick={dismissPrompt}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-slate-100"
                aria-label="Để sau"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {state.error && (
            <div className="mt-4 flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{state.error}</span>
            </div>
          )}

          {state.status === "downloading" && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[11px] font-bold text-[var(--color-text-muted)]">
                <span>Đang tải bản cập nhật</span>
                <span>{progressPercent === null ? "..." : `${progressPercent}%`}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-orange-100">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-[width]"
                  style={{ width: progressPercent === null ? "20%" : `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {state.status === "installing" && (
            <p className="mt-4 flex items-center gap-2 text-xs font-bold text-[var(--color-accent)]">
              <RefreshCw className="size-4 animate-spin" /> Đang cài đặt và khởi động lại...
            </p>
          )}

          {!isBusy && (
            <div className={`mt-5 grid gap-3 ${isMandatory ? "grid-cols-1" : "grid-cols-2"}`}>
              {!isMandatory && (
                <button
                  type="button"
                  onClick={dismissPrompt}
                  className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-bold text-[var(--color-text-secondary)] hover:bg-slate-50"
                >
                  Để sau
                </button>
              )}
              <button
                type="button"
                onClick={() => void installUpdate()}
                className="min-h-11 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white hover:opacity-90"
              >
                {isMandatory ? "Cập nhật để tiếp tục" : "Cập nhật ngay"}
              </button>
            </div>
          )}
          </div>
        </aside>
      )}
    </UpdateContext.Provider>
  );
};

export const useUpdater = (): UpdateContextValue => {
  const context = useContext(UpdateContext);
  if (!context) throw new Error("useUpdater phải được dùng bên trong UpdateProvider.");
  return context;
};

export default UpdateProvider;
