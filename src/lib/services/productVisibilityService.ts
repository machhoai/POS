import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { loadDeviceCredential } from "@/lib/services/deviceEnrollmentService";
import type {
  ProductVisibilitySettings,
  ProductVisibilityView,
} from "@/lib/types/productVisibility";
import { parseRetryAfterMs } from "@/lib/utils/remoteSettingsPolling";

const API_BASE_URL = process.env.NEXT_PUBLIC_JPULSE_API_URL || "http://api.wms.localhost";

interface ApiEnvelope<T> {
  data: T | null;
  messages?: { vi?: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const user = auth.currentUser;
  const credential = await loadDeviceCredential();
  if (!user) throw new Error("Vui lòng đăng nhập để cấu hình sản phẩm.");
  if (!credential) throw new Error("Máy JPOS chưa được kích hoạt trên JPULSE.");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  headers.set("X-Pos-Device-Id", credential.device_id);
  headers.set("X-Pos-Device-Credential", credential.device_credential);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !envelope.data) {
    if (response.status === 429) {
      const retryMs = parseRetryAfterMs(response.headers.get("Retry-After"));
      throw new Error(`Thao tác quá nhanh. Vui lòng thử lại sau ${Math.max(1, Math.ceil((retryMs ?? 60_000) / 1_000))} giây.`);
    }
    throw new Error(envelope.messages?.vi || "Không thể xử lý cấu hình sản phẩm.");
  }
  return envelope.data;
}

export const getProductVisibilityEditor = (): Promise<ProductVisibilityView> =>
  request("/api/pos/devices/product-visibility-settings/editor");

let saveInFlight: Promise<ProductVisibilitySettings> | null = null;

export const saveProductVisibility = (input: {
  expectedVersion: number;
  disabledGroupKeys: string[];
  disabledProductIds: string[];
}): Promise<ProductVisibilitySettings> => {
  if (saveInFlight) return saveInFlight;
  saveInFlight = request<ProductVisibilitySettings>("/api/pos/devices/product-visibility-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expected_version: input.expectedVersion,
      disabled_group_keys: input.disabledGroupKeys,
      disabled_product_ids: input.disabledProductIds,
      action_time: new Date().toISOString(),
    }),
  }).finally(() => {
    saveInFlight = null;
  });
  return saveInFlight;
};

export function listenProductVisibility(
  warehouseId: string,
  onSettings: (settings: ProductVisibilitySettings | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, "pos_product_visibility_settings", warehouseId),
    (snapshot) => onSettings(snapshot.exists()
      ? ({ id: warehouseId, warehouse_id: warehouseId, ...snapshot.data() } as ProductVisibilitySettings)
      : null),
    onError,
  );
}
