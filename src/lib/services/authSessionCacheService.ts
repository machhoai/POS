import { invoke } from "@tauri-apps/api/core";

import { POS_OFFLINE_ACCESS_TTL_MS, isTauriRuntime } from "@/lib/services/deviceEnrollmentService";
import type { AuthSessionData } from "@/lib/types/user";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

interface StoredAuthSession {
  user_id: string;
  verified_at: string;
  session: AuthSessionData;
}

export async function cacheAuthSession(session: AuthSessionData): Promise<void> {
  if (!isTauriRuntime()) return;
  const value: StoredAuthSession = {
    user_id: session.user.id,
    verified_at: new Date().toISOString(),
    session,
  };
  await invoke("save_pos_auth_session_cache", { value });
}

export async function loadUsableCachedAuthSession(
  userId: string,
  warehouseId: string,
  now = Date.now(),
): Promise<AuthSessionData | null> {
  if (!isTauriRuntime()) return null;
  const value = await invoke<StoredAuthSession | null>("load_pos_auth_session_cache");
  if (!value || value.user_id !== userId || value.session.user.id !== userId) return null;
  const verifiedAt = Date.parse(value.verified_at);
  const age = now - verifiedAt;
  if (
    !Number.isFinite(verifiedAt) ||
    age < -MAX_CLOCK_SKEW_MS ||
    age > POS_OFFLINE_ACCESS_TTL_MS
  ) {
    return null;
  }
  if (!value.session.warehouses.some((warehouse) => warehouse.id === warehouseId)) {
    return null;
  }
  return value.session;
}

export async function clearCachedAuthSession(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("clear_pos_auth_session_cache");
}
