import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";

import type { CustomerDisplayAdvertisingView } from "@/lib/types/customerDisplayAdvertising";

const MAIN_WINDOW_LABEL = "main";
const CUSTOMER_DISPLAY_LABEL = "customer-display";
const SETTINGS_CHANGED_EVENT = "customer-display-advertising-changed";
const SETTINGS_READY_EVENT = "customer-display-advertising-ready";
const BROWSER_CHANNEL_NAME = "jpos-customer-display-advertising-bridge-v1";
const CACHE_KEY = "jpos:customer-display-advertising-bridge:v1";

interface AdvertisingEnvelope {
  version: 1;
  type: "ADVERTISING";
  sentAt: number;
  view: CustomerDisplayAdvertisingView;
}

interface ReadyEnvelope {
  version: 1;
  type: "READY";
  sentAt: number;
}

type BridgeEnvelope = AdvertisingEnvelope | ReadyEnvelope;
type StopListening = () => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAdvertisingEnvelope(value: unknown): value is AdvertisingEnvelope {
  return isRecord(value) &&
    value.version === 1 &&
    value.type === "ADVERTISING" &&
    typeof value.sentAt === "number" &&
    isRecord(value.view) &&
    Array.isArray(value.view.media);
}

function createBrowserChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(BROWSER_CHANNEL_NAME);
}

function publishBrowserEnvelope(envelope: BridgeEnvelope): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch (error: unknown) {
    console.warn("[Quảng cáo màn hình khách] Không thể lưu bridge snapshot:", error);
  }
  const channel = createBrowserChannel();
  channel?.postMessage(envelope);
  channel?.close();
}

export async function publishCustomerDisplayAdvertising(
  view: CustomerDisplayAdvertisingView,
): Promise<void> {
  const envelope: AdvertisingEnvelope = {
    version: 1,
    type: "ADVERTISING",
    sentAt: Date.now(),
    view,
  };
  publishBrowserEnvelope(envelope);
  if (isTauri()) {
    await emitTo(CUSTOMER_DISPLAY_LABEL, SETTINGS_CHANGED_EVENT, envelope);
  }
}

export async function listenCustomerDisplayAdvertising(
  callback: (view: CustomerDisplayAdvertisingView) => void,
): Promise<StopListening> {
  let lastReceivedAt = 0;
  const receive = (value: unknown) => {
    if (!isAdvertisingEnvelope(value) || value.sentAt <= lastReceivedAt) return;
    lastReceivedAt = value.sentAt;
    callback(value.view);
  };
  const channel = createBrowserChannel();
  const onMessage = (event: MessageEvent<BridgeEnvelope>) => receive(event.data);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CACHE_KEY || !event.newValue) return;
    try {
      receive(JSON.parse(event.newValue) as unknown);
    } catch (error: unknown) {
      console.warn("[Quảng cáo màn hình khách] Bridge snapshot không hợp lệ:", error);
    }
  };
  channel?.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);
  const stopTauriListening = isTauri()
    ? await listen<AdvertisingEnvelope>(SETTINGS_CHANGED_EVENT, (event) => receive(event.payload))
    : null;

  try {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (cached) receive(JSON.parse(cached) as unknown);
  } catch (error: unknown) {
    console.warn("[Quảng cáo màn hình khách] Không thể đọc bridge snapshot:", error);
  }

  return () => {
    channel?.removeEventListener("message", onMessage);
    channel?.close();
    window.removeEventListener("storage", onStorage);
    stopTauriListening?.();
  };
}

export async function announceCustomerDisplayAdvertisingReady(): Promise<void> {
  const envelope: ReadyEnvelope = { version: 1, type: "READY", sentAt: Date.now() };
  publishBrowserEnvelope(envelope);
  if (isTauri()) {
    await emitTo(MAIN_WINDOW_LABEL, SETTINGS_READY_EVENT, envelope);
  }
}

export async function listenCustomerDisplayAdvertisingReady(
  callback: () => void,
): Promise<StopListening> {
  if (isTauri()) {
    return listen<ReadyEnvelope>(SETTINGS_READY_EVENT, () => callback());
  }
  const channel = createBrowserChannel();
  const onMessage = (event: MessageEvent<BridgeEnvelope>) => {
    if (event.data?.type === "READY") callback();
  };
  channel?.addEventListener("message", onMessage);
  return () => {
    channel?.removeEventListener("message", onMessage);
    channel?.close();
  };
}
