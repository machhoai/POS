import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase";
import { POS_COLLECTIONS } from "../config/collections";
import { getPosAuthSession } from "../services/posAuthService";
import type {
  LuckyDrawSettings,
  LuckyDrawSettingsInput,
} from "../types/luckyDrawSettings";
import { normalizeLuckyDrawSettings } from "./luckyDrawSettingsPolicy";

const MANAGE_SETTINGS_PERMISSION = "pos.settings.manage";

function readWarehouseId(data: unknown): string {
  const warehouseId = data && typeof data === "object"
    ? (data as { warehouseId?: unknown }).warehouseId
    : undefined;
  if (typeof warehouseId !== "string" || !warehouseId.trim()) {
    throw new HttpsError("invalid-argument", "Điểm bán không hợp lệ.");
  }
  return warehouseId.trim();
}

function hasScopedPermission(
  permissions: Record<string, Record<string, unknown>>,
  key: string,
  warehouseId: string,
): boolean {
  return permissions.global?.["*"] === true ||
    permissions.global?.[key] === true ||
    permissions[warehouseId]?.["*"] === true ||
    permissions[warehouseId]?.[key] === true;
}

async function requireAccessibleWarehouse(userId: string, warehouseId: string) {
  const session = await getPosAuthSession(userId);
  if (!session.warehouses.some((warehouse) => warehouse.id === warehouseId)) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền truy cập cấu hình bốc thăm của điểm bán này.",
    );
  }
  return session;
}

export async function getLuckyDrawSettingsForWarehouse(
  warehouseId: string,
): Promise<LuckyDrawSettings | null> {
  const snapshot = await db
    .collection(POS_COLLECTIONS.luckyDrawSettings)
    .doc(warehouseId)
    .get();
  return snapshot.exists ? snapshot.data() as LuckyDrawSettings : null;
}

export async function getLuckyDrawSettingsForUser(
  userId: string,
  data: unknown,
) {
  const warehouseId = readWarehouseId(data);
  await requireAccessibleWarehouse(userId, warehouseId);
  return { settings: await getLuckyDrawSettingsForWarehouse(warehouseId) };
}

export async function saveLuckyDrawSettingsForUser(
  userId: string,
  data: unknown,
) {
  let normalized: LuckyDrawSettingsInput;
  try {
    normalized = normalizeLuckyDrawSettings(data);
  } catch (error: unknown) {
    throw new HttpsError(
      "invalid-argument",
      error instanceof Error ? error.message : "Cấu hình bốc thăm không hợp lệ.",
    );
  }
  const session = await requireAccessibleWarehouse(userId, normalized.warehouseId);
  if (!hasScopedPermission(session.permissions, MANAGE_SETTINGS_PERMISSION, normalized.warehouseId)) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền thay đổi cấu hình phiếu bốc thăm.",
    );
  }

  const docRef = db
    .collection(POS_COLLECTIONS.luckyDrawSettings)
    .doc(normalized.warehouseId);
  const settings = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const currentVersion = snapshot.exists
      ? Number((snapshot.data() as Partial<LuckyDrawSettings>).version) || 0
      : 0;
    const next: LuckyDrawSettings = {
      ...normalized,
      version: currentVersion + 1,
      updatedAt: new Date().toISOString(),
      updatedByUid: userId,
    };
    transaction.set(docRef, next);
    return next;
  });
  return { settings };
}
