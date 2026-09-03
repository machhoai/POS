import type { FixedTransferSettings } from "@/lib/types/paymentSettings";

const CACHE_KEY = "jpos_payment_settings_cache_v1";

export function cachePaymentSettings(settings: FixedTransferSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
}

export function clearCachedPaymentSettings(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CACHE_KEY);
}

export function loadCachedPaymentSettings(
  deviceId: string,
  warehouseId: string,
): FixedTransferSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as FixedTransferSettings;
    return value.deviceId === deviceId && value.warehouseId === warehouseId
      ? value
      : null;
  } catch {
    return null;
  }
}
