import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";

import {
  DEFAULT_CUSTOMER_DISPLAY_CONTROL,
  type CustomerDisplayControlState,
  type CustomerDisplayLanguage,
} from "@/lib/types/customerDisplayControl";

const CUSTOMER_DISPLAY_LABEL = "customer-display";
const CONTROL_CHANGED_EVENT = "customer-display-control-changed";
const BROWSER_CHANNEL_NAME = "jpos-customer-display-control-v1";
const CONTROL_CACHE_KEY = "jpos:customer-display-control:v1";

interface ControlEnvelope {
  version: 1;
  type: "CONTROL";
  sentAt: number;
  state: CustomerDisplayControlState;
}

type StopListening = () => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLanguage(value: unknown): value is CustomerDisplayLanguage {
  return value === "vi" || value === "en" || value === "zh";
}

function isControlEnvelope(value: unknown): value is ControlEnvelope {
  if (!isRecord(value) || value.version !== 1 || value.type !== "CONTROL") {
    return false;
  }
  if (typeof value.sentAt !== "number" || !isRecord(value.state)) return false;
  return (
    isLanguage(value.state.language) &&
    (typeof value.state.pinnedSlideId === "string" ||
      value.state.pinnedSlideId === null)
  );
}

function createBrowserChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(BROWSER_CHANNEL_NAME);
}

export function readCustomerDisplayControl(): CustomerDisplayControlState {
  if (typeof window === "undefined") return DEFAULT_CUSTOMER_DISPLAY_CONTROL;
  try {
    const raw = window.localStorage.getItem(CONTROL_CACHE_KEY);
    if (!raw) return DEFAULT_CUSTOMER_DISPLAY_CONTROL;
    const parsed: unknown = JSON.parse(raw);
    return isControlEnvelope(parsed)
      ? parsed.state
      : DEFAULT_CUSTOMER_DISPLAY_CONTROL;
  } catch (error: unknown) {
    console.warn("[Điều khiển màn hình khách] Không thể đọc cấu hình:", error);
    return DEFAULT_CUSTOMER_DISPLAY_CONTROL;
  }
}

export async function publishCustomerDisplayControl(
  state: CustomerDisplayControlState,
): Promise<void> {
  const envelope: ControlEnvelope = {
    version: 1,
    type: "CONTROL",
    sentAt: Date.now(),
    state,
  };

  try {
    window.localStorage.setItem(CONTROL_CACHE_KEY, JSON.stringify(envelope));
  } catch (error: unknown) {
    console.warn("[Điều khiển màn hình khách] Không thể lưu cấu hình:", error);
  }
  const channel = createBrowserChannel();
  channel?.postMessage(envelope);
  channel?.close();

  if (isTauri()) {
    await emitTo(CUSTOMER_DISPLAY_LABEL, CONTROL_CHANGED_EVENT, envelope);
  }
}

export async function listenCustomerDisplayControl(
  callback: (state: CustomerDisplayControlState) => void,
): Promise<StopListening> {
  let lastReceivedAt = 0;
  const receiveEnvelope = (value: unknown) => {
    if (!isControlEnvelope(value) || value.sentAt <= lastReceivedAt) return;
    lastReceivedAt = value.sentAt;
    callback(value.state);
  };

  const channel = createBrowserChannel();
  const onMessage = (event: MessageEvent<ControlEnvelope>) => {
    receiveEnvelope(event.data);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CONTROL_CACHE_KEY || !event.newValue) return;
    try {
      receiveEnvelope(JSON.parse(event.newValue) as unknown);
    } catch (error: unknown) {
      console.warn("[Điều khiển màn hình khách] Cấu hình không hợp lệ:", error);
    }
  };

  channel?.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);

  const stopTauriListening = isTauri()
    ? await listen<ControlEnvelope>(CONTROL_CHANGED_EVENT, (event) => {
        receiveEnvelope(event.payload);
      })
    : null;

  try {
    const raw = window.localStorage.getItem(CONTROL_CACHE_KEY);
    if (raw) receiveEnvelope(JSON.parse(raw) as unknown);
  } catch (error: unknown) {
    console.warn("[Điều khiển màn hình khách] Không thể khôi phục cấu hình:", error);
  }

  return () => {
    channel?.removeEventListener("message", onMessage);
    channel?.close();
    window.removeEventListener("storage", onStorage);
    stopTauriListening?.();
  };
}
