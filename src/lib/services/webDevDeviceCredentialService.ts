import type { PosDeviceCredential } from "@/lib/types/deviceEnrollment";

const CREDENTIAL_STORAGE_KEY = "jpos_web_dev_device_credential_v1";
const INSTALLATION_ID_STORAGE_KEY = "jpos_web_dev_installation_id_v1";

const isCredential = (value: unknown): value is PosDeviceCredential => {
  if (!value || typeof value !== "object") return false;
  const credential = value as Partial<PosDeviceCredential>;
  return (
    typeof credential.device_id === "string" &&
    typeof credential.device_credential === "string" &&
    typeof credential.warehouse_id === "string"
  );
};

export const isLocalWebDevelopmentRuntime = (): boolean => {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
    return false;
  }
  if ("__TAURI_INTERNALS__" in window) return false;
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
};

export const loadWebDevDeviceCredential = (): PosDeviceCredential | null => {
  if (!isLocalWebDevelopmentRuntime()) return null;
  const stored = window.localStorage.getItem(CREDENTIAL_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (isCredential(parsed)) return parsed;
  } catch {
    // Dữ liệu local hỏng sẽ được xóa và kích hoạt lại bằng mã mới.
  }
  window.localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  return null;
};

export const saveWebDevDeviceCredential = (
  credential: PosDeviceCredential,
): void => {
  if (!isLocalWebDevelopmentRuntime()) return;
  window.localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(credential));
};

export const clearWebDevDeviceCredential = (): void => {
  if (!isLocalWebDevelopmentRuntime()) return;
  window.localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
};

export const getOrCreateWebDevInstallationId = (): string => {
  if (!isLocalWebDevelopmentRuntime()) {
    throw new Error("Web dev chỉ được hỗ trợ trên địa chỉ local.");
  }
  const stored = window.localStorage.getItem(INSTALLATION_ID_STORAGE_KEY);
  if (stored) return stored;
  const installationId = `web-dev:${crypto.randomUUID()}`;
  window.localStorage.setItem(INSTALLATION_ID_STORAGE_KEY, installationId);
  return installationId;
};
