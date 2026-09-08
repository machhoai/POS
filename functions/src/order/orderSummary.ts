import { onDocumentWritten } from "firebase-functions/v2/firestore";

import { db } from "../config/firebase";
import { POS_COLLECTIONS } from "../config/collections";
import type { PosOrder } from "../types/order";

const normalizePhone = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("84") && digits.length >= 11
    ? `0${digits.slice(2)}`
    : digits;
};

const paymentStatusOf = (order: PosOrder): string =>
  order.paymentStatus ?? (order.status === "DRAFT" ? "DRAFT" : "PAID");

const syncStatusOf = (order: PosOrder): string => {
  if (order.syncStatus) return order.syncStatus;
  return {
    DRAFT: "NOT_SYNCED",
    LOCAL_PAID: "PENDING",
    SYNCING: "SYNCING",
    SYNC_FAILED: "SYNC_FAILED",
    SYNC_SUCCESS: "SYNC_SUCCESS",
  }[order.status];
};

export const buildPosOrderSummary = (order: PosOrder) => {
  const customerPhone = order.member?.phone?.trim() || null;
  return {
    id: order.localOrderId,
    localOrderId: order.localOrderId,
    warehouseId: order.warehouseId,
    source: order.source ?? "JPOS",
    legacyStatus: order.status,
    paymentStatus: paymentStatusOf(order),
    syncStatus: syncStatusOf(order),
    hkOrderNumber: order.hkOrderNumber ?? null,
    remoteOrderId: order.remoteOrderId ?? null,
    customerName: order.member?.fullName?.trim() || null,
    customerPhone,
    normalizedPhone: normalizePhone(customerPhone),
    operatorId: order.operatorId,
    operatorName: order.operatorName,
    productNames: Array.from(
      new Set(order.items.map((item) => item.goodsName.trim()).filter(Boolean)),
    ),
    items: order.items.map((item) => ({
      goodsId: item.goodsId,
      goodsName: item.goodsName,
      quantity: item.quantity,
      price: item.price,
    })),
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? null,
    cancelledAt: order.cancelledAt ?? null,
    version: order.version ?? 0,
    is_deleted: false,
    updatedAt: order.updatedAt,
  };
};

export const onPosOrderSummaryChanged = onDocumentWritten(
  {
    document: `${POS_COLLECTIONS.orders}/{orderId}`,
    region: "asia-southeast1",
  },
  async (event) => {
    const summaryRef = db
      .collection(POS_COLLECTIONS.orderSummaries)
      .doc(event.params.orderId);
    const snapshot = event.data?.after;
    if (!snapshot?.exists) {
      await summaryRef.set(
        { is_deleted: true, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return;
    }
    await summaryRef.set(
      buildPosOrderSummary(snapshot.data() as PosOrder),
      { merge: false },
    );
  },
);

