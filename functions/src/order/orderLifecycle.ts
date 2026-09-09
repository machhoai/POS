import type { OrderKind, OrderStatus } from "../types/order";

interface SyncGuardOrder {
  status: OrderStatus;
  orderKind?: OrderKind;
  paymentStatus?: string;
  syncStatus?: string;
  cancellationOperationId?: string | null;
}

export function isRevenueEligibleOrder(order: SyncGuardOrder): boolean {
  if (order.syncStatus === "CANCELLED") return false;
  if (order.paymentStatus) {
    return order.paymentStatus !== "DRAFT" &&
      order.paymentStatus !== "REFUNDED";
  }
  return order.status !== "DRAFT";
}

const isCancellationLocked = (order: SyncGuardOrder): boolean =>
  Boolean(order.cancellationOperationId) ||
  ["REFUNDING", "REFUNDED", "REFUND_UNKNOWN"].includes(
    order.paymentStatus ?? "",
  ) ||
  order.syncStatus === "CANCELLED";

/**
 * Remote synchronization starts only after a locally verified payment.
 * Creating or refreshing a PayOS QR keeps the order in DRAFT and returns false.
 */
export function shouldSynchronizeRemoteOrder(
  beforeStatus: OrderStatus,
  afterStatus: OrderStatus,
  orderKind: OrderKind = "STANDARD",
): boolean {
  return orderKind !== "MEMBER_PACKAGE" &&
    beforeStatus !== afterStatus &&
    afterStatus === "LOCAL_PAID";
}

/** Re-read guard used immediately before a worker claims the order. */
export function canClaimRemoteOrderSync(order: SyncGuardOrder): boolean {
  return (
    order.status === "LOCAL_PAID" &&
    (order.orderKind ?? "STANDARD") !== "MEMBER_PACKAGE" &&
    !isCancellationLocked(order)
  );
}

/** Retry guards must match the same cancellation lock as the trigger worker. */
export function canQueueRemoteOrderRetry(order: SyncGuardOrder): boolean {
  return (
    order.status === "SYNC_FAILED" &&
    (order.orderKind ?? "STANDARD") !== "MEMBER_PACKAGE" &&
    !isCancellationLocked(order)
  );
}
