import { emitTo, listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import type { CustomerDisplayState } from "@/lib/types/customerDisplay";

const MAIN_WINDOW_LABEL = "main";
const CUSTOMER_DISPLAY_LABEL = "customer-display";
const STATE_CHANGED_EVENT = "customer-display-state-changed";
const DISPLAY_READY_EVENT = "customer-display-ready";
const BROWSER_CHANNEL_NAME = "jpos-customer-display-v1";
const STATE_CACHE_KEY = "jpos:customer-display-state:v1";
const READY_CACHE_KEY = "jpos:customer-display-ready:v1";
const CACHE_TTL_MS = 10_000;

interface StateEnvelope {
  version: 1;
  type: "STATE";
  sentAt: number;
  state: CustomerDisplayState;
}

interface ReadyEnvelope {
  version: 1;
  type: "READY";
  sentAt: number;
}

type BrowserEnvelope = StateEnvelope | ReadyEnvelope;
type StopListening = () => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStateEnvelope(value: unknown): value is StateEnvelope {
  if (!isRecord(value) || value.version !== 1 || value.type !== "STATE") {
    return false;
  }
  if (typeof value.sentAt !== "number" || !isRecord(value.state)) return false;
  return [
    "IDLE",
    "CART",
    "TRANSFER",
    "SUCCESS",
    "MEMBER_REVIEW",
    "MEMBER_SUCCESS",
  ].includes(
    String(value.state.mode),
  );
}

function createBrowserChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(BROWSER_CHANNEL_NAME);
}

function readCachedState(): StateEnvelope | null {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStateEnvelope(parsed) || Date.now() - parsed.sentAt > CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch (error: unknown) {
    console.warn("[Màn hình khách] Không thể đọc snapshot trình duyệt:", error);
    return null;
  }
}

function writeBrowserEnvelope(key: string, envelope: BrowserEnvelope): void {
  try {
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch (error: unknown) {
    console.warn("[Màn hình khách] Không thể lưu snapshot trình duyệt:", error);
  }

  const channel = createBrowserChannel();
  channel?.postMessage(envelope);
  channel?.close();
}

export async function publishCustomerDisplayState(
  state: CustomerDisplayState,
): Promise<void> {
  if (isTauri()) {
    await emitTo(CUSTOMER_DISPLAY_LABEL, STATE_CHANGED_EVENT, state);
    return;
  }

  writeBrowserEnvelope(STATE_CACHE_KEY, {
    version: 1,
    type: "STATE",
    sentAt: Date.now(),
    state,
  });
}

export async function listenCustomerDisplayReady(
  callback: () => void,
): Promise<StopListening> {
  if (isTauri()) {
    return listen(DISPLAY_READY_EVENT, callback);
  }

  const channel = createBrowserChannel();
  const onMessage = (event: MessageEvent<BrowserEnvelope>) => {
    if (event.data?.type === "READY") callback();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === READY_CACHE_KEY && event.newValue) callback();
  };
  channel?.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);

  return () => {
    channel?.removeEventListener("message", onMessage);
    channel?.close();
    window.removeEventListener("storage", onStorage);
  };
}

export async function listenCustomerDisplayState(
  callback: (state: CustomerDisplayState) => void,
): Promise<StopListening> {
  if (isTauri()) {
    return listen<CustomerDisplayState>(STATE_CHANGED_EVENT, (event) => {
      callback(event.payload);
    });
  }

  let lastReceivedAt = 0;
  const receiveEnvelope = (value: unknown) => {
    if (!isStateEnvelope(value) || value.sentAt <= lastReceivedAt) return;
    lastReceivedAt = value.sentAt;
    callback(value.state);
  };
  const channel = createBrowserChannel();
  const onMessage = (event: MessageEvent<BrowserEnvelope>) => {
    receiveEnvelope(event.data);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STATE_CACHE_KEY || !event.newValue) return;
    try {
      receiveEnvelope(JSON.parse(event.newValue) as unknown);
    } catch (error: unknown) {
      console.warn("[Màn hình khách] Snapshot trình duyệt không hợp lệ:", error);
    }
  };
  channel?.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);

  const cached = readCachedState();
  if (cached) receiveEnvelope(cached);

  return () => {
    channel?.removeEventListener("message", onMessage);
    channel?.close();
    window.removeEventListener("storage", onStorage);
  };
}

export async function announceCustomerDisplayReady(): Promise<void> {
  if (isTauri()) {
    await emitTo(MAIN_WINDOW_LABEL, DISPLAY_READY_EVENT, null);
    return;
  }

  writeBrowserEnvelope(READY_CACHE_KEY, {
    version: 1,
    type: "READY",
    sentAt: Date.now(),
  });
}
