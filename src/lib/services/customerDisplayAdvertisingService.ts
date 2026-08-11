import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { loadDeviceCredential } from "@/lib/services/deviceEnrollmentService";
import type {
  CustomerDisplayAdvertisingView,
  CustomerDisplayPlaylistItem,
} from "@/lib/types/customerDisplayAdvertising";

const API_BASE_URL = process.env.NEXT_PUBLIC_JPULSE_API_URL || "http://api.wms.localhost";

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  messages?: { vi?: string };
}

async function deviceEditorFetch(path: string, init?: RequestInit): Promise<Response> {
  const user = auth.currentUser;
  const credential = await loadDeviceCredential();
  if (!user) throw new Error("Vui lòng đăng nhập để cấu hình quảng cáo.");
  if (!credential) throw new Error("Máy JPOS chưa được kích hoạt trên JPULSE.");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  headers.set("X-Pos-Device-Id", credential.device_id);
  headers.set("X-Pos-Device-Credential", credential.device_credential);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

async function readView(response: Response): Promise<CustomerDisplayAdvertisingView> {
  const envelope = (await response.json()) as ApiEnvelope<CustomerDisplayAdvertisingView>;
  if (!response.ok || !envelope.data) {
    throw new Error(envelope.messages?.vi || "Không thể xử lý cấu hình quảng cáo.");
  }
  return envelope.data;
}

export async function getCustomerDisplayAdvertising(): Promise<CustomerDisplayAdvertisingView> {
  return readView(await deviceEditorFetch("/api/pos/devices/customer-display-settings/editor"));
}

export async function saveCustomerDisplayAdvertising(input: {
  expectedVersion: number;
  playlist: CustomerDisplayPlaylistItem[];
}): Promise<CustomerDisplayAdvertisingView> {
  return readView(await deviceEditorFetch("/api/pos/devices/customer-display-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expected_version: input.expectedVersion,
      playlist: input.playlist,
      action_time: new Date().toISOString(),
    }),
  }));
}

export async function uploadCustomerDisplayAdvertising(
  file: File,
  expectedVersion: number,
): Promise<CustomerDisplayAdvertisingView> {
  return readView(await deviceEditorFetch("/api/pos/devices/customer-display-media", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      "X-Expected-Version": String(expectedVersion),
      "X-Action-Time": new Date().toISOString(),
    },
    body: file,
  }));
}

export async function removeCustomerDisplayAdvertising(
  mediaId: string,
  expectedVersion: number,
): Promise<CustomerDisplayAdvertisingView> {
  return readView(await deviceEditorFetch(`/api/pos/devices/customer-display-media/${mediaId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expected_version: expectedVersion,
      action_time: new Date().toISOString(),
    }),
  }));
}

export function listenCustomerDisplayAdvertisingVersion(
  warehouseId: string,
  onVersion: (version: number) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, "pos_customer_display_settings", warehouseId),
    (snapshot) => onVersion(snapshot.exists() ? Number(snapshot.data().version ?? 0) : 0),
    (error) => onError(error),
  );
}
