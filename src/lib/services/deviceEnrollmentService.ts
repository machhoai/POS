import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import type {
  PosDeviceActivationResult,
  PosDeviceCredential,
  PosDeviceSessionResult,
  PosReceiptSettingsWatchResult,
  RemotePosReceiptSettings,
} from "@/lib/types/deviceEnrollment";
import { mapReceiptSettingsToRemote } from "@/features/receipt/helpers/remoteReceiptSettings";
import type { ReceiptSettings } from "@/features/receipt/types/receipt";
import {
  clearWebDevDeviceCredential,
  getOrCreateWebDevInstallationId,
  isLocalWebDevelopmentRuntime,
  loadWebDevDeviceCredential,
  saveWebDevDeviceCredential,
} from "@/lib/services/webDevDeviceCredentialService";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_JPULSE_API_URL || "http://api.wms.localhost";
export const POS_OFFLINE_ACCESS_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  messages?: { vi?: string };
}

export const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const isDeviceEnrollmentRuntime = (): boolean =>
  isTauriRuntime() || isLocalWebDevelopmentRuntime();

const getRuntimeAppVersion = async (): Promise<string> =>
  isTauriRuntime() ? getVersion() : "web-dev";

const getRuntimeInstallationId = async (): Promise<string> =>
  isTauriRuntime()
    ? invoke<string>("get_or_create_pos_installation_id")
    : getOrCreateWebDevInstallationId();

export async function loadDeviceCredential(): Promise<PosDeviceCredential | null> {
  if (isTauriRuntime()) {
    return invoke<PosDeviceCredential | null>("load_pos_device_credential");
  }
  return loadWebDevDeviceCredential();
}

export async function clearDeviceCredential(): Promise<void> {
  if (isTauriRuntime()) {
    await Promise.all([
      invoke("clear_pos_device_credential"),
      invoke("clear_pos_auth_session_cache"),
    ]);
    return;
  }
  clearWebDevDeviceCredential();
}

export async function saveDeviceCredential(
  credential: PosDeviceCredential,
): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("save_pos_device_credential", { value: credential });
    return;
  }
  saveWebDevDeviceCredential(credential);
}

export function canUseOfflineDeviceCredential(
  credential: PosDeviceCredential,
  now = Date.now(),
): boolean {
  const verifiedAt = Date.parse(credential.last_verified_at || "");
  if (!Number.isFinite(verifiedAt)) return false;
  const age = now - verifiedAt;
  return age >= -MAX_CLOCK_SKEW_MS && age <= POS_OFFLINE_ACCESS_TTL_MS;
}

function createDeviceCredential(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function withDeviceAuth<T extends Record<string, unknown>>(
  data: T,
): Promise<T & { device_auth: PosDeviceCredential }> {
  const credential = await loadDeviceCredential();
  if (!credential) {
    throw new Error("Máy POS chưa được kích hoạt trên JPULSE.");
  }
  return { ...data, device_auth: credential };
}

export async function activateDevice(input: {
  pairingCode: string;
  deviceName: string;
}): Promise<PosDeviceCredential> {
  const fingerprint = await getRuntimeInstallationId();
  const appVersion = await getRuntimeAppVersion();
  const pendingCredential: PosDeviceCredential = {
    device_id: crypto.randomUUID(),
    device_credential: createDeviceCredential(),
    warehouse_id: "",
    last_verified_at: undefined,
  };
  await saveDeviceCredential(pendingCredential);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/pos/devices/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairing_code: input.pairingCode,
        device_id: pendingCredential.device_id,
        device_credential: pendingCredential.device_credential,
        device_name: input.deviceName,
        fingerprint,
        app_version: appVersion,
        operating_system: navigator.userAgent.slice(0, 100),
      }),
    });
  } catch (error) {
    throw new Error(
      "Kết nối bị gián đoạn khi kích hoạt. Khóa đã được giữ an toàn để tự khôi phục ở lần mở sau.",
      { cause: error },
    );
  }
  const envelope = (await response.json()) as ApiEnvelope<PosDeviceActivationResult>;
  if (!response.ok || !envelope.data) {
    await clearDeviceCredential();
    throw new Error(envelope.messages?.vi || "Không thể kích hoạt máy POS.");
  }

  const credential: PosDeviceCredential = {
    device_id: envelope.data.device.id,
    device_credential: envelope.data.device_credential,
    warehouse_id: envelope.data.device.warehouse_id,
    last_verified_at: new Date().toISOString(),
  };
  await saveDeviceCredential(credential);
  return credential;
}

export class DeviceSessionError extends Error {
  constructor(message: string, public readonly revoked: boolean) {
    super(message);
    this.name = "DeviceSessionError";
  }
}

export async function openDeviceSession(
  credential: PosDeviceCredential,
): Promise<PosDeviceSessionResult> {
  const appVersion = await getRuntimeAppVersion();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/pos/devices/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: credential.device_id,
        device_credential: credential.device_credential,
        app_version: appVersion,
      }),
    });
  } catch {
    throw new DeviceSessionError(
      "Không thể kiểm tra trạng thái máy POS. Đang dùng dữ liệu cục bộ.",
      false,
    );
  }
  const envelope = (await response.json()) as ApiEnvelope<PosDeviceSessionResult>;
  if (!response.ok || !envelope.data) {
    throw new DeviceSessionError(
      envelope.messages?.vi || "Máy POS không còn quyền truy cập.",
      response.status === 401 || response.status === 403,
    );
  }
  return envelope.data;
}

export async function watchRemoteReceiptSettings(
  credential: PosDeviceCredential,
  knownVersion: number | null,
  signal: AbortSignal,
): Promise<PosReceiptSettingsWatchResult> {
  const appVersion = await getRuntimeAppVersion();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/pos/devices/receipt-settings/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: credential.device_id,
        device_credential: credential.device_credential,
        app_version: appVersion,
        known_version: knownVersion,
      }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new DeviceSessionError(
      "Không thể theo dõi cấu hình hóa đơn mới. JPOS sẽ tự kết nối lại.",
      false,
    );
  }
  const envelope = (await response.json()) as ApiEnvelope<PosReceiptSettingsWatchResult>;
  if (!response.ok || !envelope.data) {
    throw new DeviceSessionError(
      envelope.messages?.vi || "Không thể nhận cấu hình hóa đơn POS.",
      response.status === 401 || response.status === 403,
    );
  }
  return envelope.data;
}

export async function saveRemoteReceiptSettings(
  settings: ReceiptSettings,
): Promise<RemotePosReceiptSettings> {
  const credential = await loadDeviceCredential();
  if (!credential) {
    throw new Error("Máy POS chưa được kích hoạt trên JPULSE.");
  }
  const appVersion = await getRuntimeAppVersion();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/pos/devices/receipt-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: credential.device_id,
        device_credential: credential.device_credential,
        app_version: appVersion,
        receipt_settings: mapReceiptSettingsToRemote(settings),
      }),
    });
  } catch {
    throw new DeviceSessionError(
      "Không thể kết nối JPULSE để lưu cấu hình biên lai.",
      false,
    );
  }
  const envelope = (await response.json()) as ApiEnvelope<RemotePosReceiptSettings>;
  if (!response.ok || !envelope.data) {
    throw new DeviceSessionError(
      envelope.messages?.vi || "Không thể lưu cấu hình biên lai lên JPULSE.",
      response.status === 401 || response.status === 403,
    );
  }
  return envelope.data;
}

export async function persistVerifiedDeviceSession(
  credential: PosDeviceCredential,
  session: PosDeviceSessionResult,
): Promise<PosDeviceCredential> {
  const serverTime = new Date(session.server_time);
  const lastVerifiedAt = Number.isFinite(serverTime.getTime())
    ? serverTime.toISOString()
    : new Date().toISOString();
  const updated: PosDeviceCredential = {
    ...credential,
    warehouse_id: session.device.warehouse_id,
    last_verified_at: lastVerifiedAt,
  };
  await saveDeviceCredential(updated);
  return updated;
}
