import { randomUUID } from "crypto";

import { db } from "../config/firebase";
import { POS_COLLECTIONS } from "../config/collections";
import { mergeHiddenProductIds } from "./productSyncVisibilityPolicy";

const MAX_VISIBILITY_KEYS = 2_000;

export interface ProductSyncActorContext {
  actorId: string;
  actionTime: string;
  requestId: string;
  source: "JPOS" | "JPULSE";
  warehouseId?: string;
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

async function listPosWarehouseIds(
  requestedWarehouseId?: string,
): Promise<string[]> {
  const [devices, settings] = await Promise.all([
    db.collection(POS_COLLECTIONS.devices).get(),
    db.collection(POS_COLLECTIONS.productVisibilitySettings).get(),
  ]);
  const warehouseIds = new Set<string>();
  if (requestedWarehouseId) warehouseIds.add(requestedWarehouseId);
  for (const document of devices.docs) {
    const value = document.data();
    if (
      value.is_deleted !== true &&
      value.status === "ACTIVE" &&
      typeof value.warehouse_id === "string" &&
      value.warehouse_id.trim()
    ) {
      warehouseIds.add(value.warehouse_id.trim());
    }
  }
  for (const document of settings.docs) {
    const value = document.data();
    if (value.is_deleted !== true) warehouseIds.add(document.id);
  }
  return [...warehouseIds].sort();
}

async function hideForWarehouse(
  warehouseId: string,
  productIds: readonly string[],
  context: ProductSyncActorContext,
): Promise<boolean> {
  const reference = db
    .collection(POS_COLLECTIONS.productVisibilitySettings)
    .doc(warehouseId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const previous = snapshot.exists ? snapshot.data() || {} : null;
    const previousDisabledIds = stringArray(previous?.disabled_product_ids);
    const disabledProductIds = mergeHiddenProductIds(
      previousDisabledIds,
      productIds,
    );
    if (disabledProductIds.length === new Set(previousDisabledIds).size) return false;
    if (disabledProductIds.length > MAX_VISIBILITY_KEYS) {
      throw new Error(
        `Product visibility limit exceeded for warehouse ${warehouseId}.`,
      );
    }

    const now = new Date();
    const current = {
      id: warehouseId,
      warehouse_id: warehouseId,
      version: Number(previous?.version || 0) + 1,
      disabled_group_keys: stringArray(previous?.disabled_group_keys).sort(),
      disabled_product_ids: disabledProductIds,
      updated_by: context.actorId,
      is_deleted: false,
      created_at: previous?.created_at || now,
      updated_at: now,
    };
    transaction.set(reference, current);

    const auditId = randomUUID();
    transaction.create(db.collection("audit_logs").doc(auditId), {
      id: auditId,
      entity_type: "POS_PRODUCT_VISIBILITY_SETTINGS",
      entity_id: warehouseId,
      warehouse_id: warehouseId,
      action: previous ? "UPDATE" : "CREATE",
      user_id: context.actorId,
      user_name: null,
      entity_name: null,
      action_time: new Date(context.actionTime),
      sync_time: now,
      old_value: previous,
      new_value: current,
      ip_address: null,
      device_id: null,
      session_token: null,
      notes: `Automatically hid ${productIds.length} new JPOS products from ${context.source} sync ${context.requestId}`,
    });
    return true;
  });
}

export async function hideNewProductsByDefault(
  productIds: readonly string[],
  context: ProductSyncActorContext,
): Promise<number> {
  if (productIds.length === 0) return 0;
  const warehouseIds = await listPosWarehouseIds(context.warehouseId);
  const results = await Promise.all(
    warehouseIds.map((warehouseId) =>
      hideForWarehouse(warehouseId, productIds, context),
    ),
  );
  return results.filter(Boolean).length;
}
