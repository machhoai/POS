import { randomUUID } from "crypto";

import { db } from "../config/firebase";
import { POS_COLLECTIONS } from "../config/collections";
import type { ProductSyncResult } from "./productSyncService";
import type { ProductSyncActorContext } from "./productSyncVisibilityService";

const LOCK_DOCUMENT_ID = "_lock";
const LOCK_TTL_MS = 10 * 60 * 1_000;

export class ProductSyncInProgressError extends Error {
  constructor() {
    super("PRODUCT_SYNC_IN_PROGRESS");
  }
}

const toDate = (value: unknown): Date | null =>
  value && typeof value === "object" && "toDate" in value
    ? (value as { toDate: () => Date }).toDate()
    : value instanceof Date
      ? value
      : null;

export async function coordinateProductSync(
  context: ProductSyncActorContext,
  execute: () => Promise<ProductSyncResult>,
): Promise<ProductSyncResult> {
  const collection = db.collection(POS_COLLECTIONS.productSyncRuns);
  const runReference = collection.doc(context.requestId);
  const lockReference = collection.doc(LOCK_DOCUMENT_ID);
  const cached = await db.runTransaction(async (transaction) => {
    const [runSnapshot, lockSnapshot] = await Promise.all([
      transaction.get(runReference),
      transaction.get(lockReference),
    ]);
    const run = runSnapshot.data();
    if (run?.status === "SUCCEEDED" && run.result) {
      return run.result as ProductSyncResult;
    }
    if (run?.status === "RUNNING") throw new ProductSyncInProgressError();
    const lock = lockSnapshot.data();
    const lockExpiry = toDate(lock?.lease_expires_at);
    if (
      lock?.status === "RUNNING" &&
      lock.request_id !== context.requestId &&
      lockExpiry &&
      lockExpiry.getTime() > Date.now()
    ) {
      throw new ProductSyncInProgressError();
    }

    const now = new Date();
    transaction.set(lockReference, {
      id: LOCK_DOCUMENT_ID,
      status: "RUNNING",
      request_id: context.requestId,
      lease_expires_at: new Date(now.getTime() + LOCK_TTL_MS),
      updated_at: now,
      is_deleted: false,
    });
    transaction.set(runReference, {
      id: context.requestId,
      status: "RUNNING",
      actor_id: context.actorId,
      warehouse_id: context.warehouseId || null,
      source: context.source,
      action_time: new Date(context.actionTime),
      sync_time: now,
      result: null,
      error: null,
      is_deleted: false,
    });
    return null;
  });
  if (cached) return cached;

  try {
    const result = await execute();
    const now = new Date();
    await db.runTransaction(async (transaction) => {
      const auditId = randomUUID();
      transaction.update(runReference, {
        status: "SUCCEEDED",
        result,
        completed_at: now,
        sync_time: now,
      });
      transaction.set(lockReference, {
        status: "IDLE",
        request_id: context.requestId,
        lease_expires_at: now,
        updated_at: now,
        is_deleted: false,
      }, { merge: true });
      transaction.create(db.collection("audit_logs").doc(auditId), {
        id: auditId,
        entity_type: "POS_PRODUCT_CATALOG_SYNC",
        entity_id: context.requestId,
        warehouse_id: context.warehouseId || null,
        action: "CREATE",
        user_id: context.actorId,
        user_name: null,
        entity_name: null,
        action_time: new Date(context.actionTime),
        sync_time: now,
        old_value: null,
        new_value: result,
        ip_address: null,
        device_id: null,
        session_token: null,
        notes: `Synchronized JPOS product catalog from ${context.source}`,
      });
    });
    return result;
  } catch (error: unknown) {
    const now = new Date();
    await db.runTransaction(async (transaction) => {
      transaction.update(runReference, {
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        completed_at: now,
        sync_time: now,
      });
      transaction.set(lockReference, {
        status: "IDLE",
        request_id: context.requestId,
        lease_expires_at: now,
        updated_at: now,
        is_deleted: false,
      }, { merge: true });
    });
    throw error;
  }
}
