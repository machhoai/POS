import type { OrderStatus, PosOrder } from "@/lib/types/order";

export type OrderDisplayStatus =
  | OrderStatus
  | "REFUNDING"
  | "REFUNDED"
  | "REFUND_FAILED"
  | "REFUND_UNKNOWN"
  | "CANCELLED";

export function getOrderDisplayStatus(order: PosOrder): OrderDisplayStatus {
  if (
    order.paymentStatus === "REFUNDING" ||
    order.paymentStatus === "REFUNDED" ||
    order.paymentStatus === "REFUND_FAILED" ||
    order.paymentStatus === "REFUND_UNKNOWN"
  ) {
    return order.paymentStatus;
  }
  if (order.syncStatus === "CANCELLED") return "CANCELLED";
  return order.status;
}

export function isOrderRevenueEligible(order: PosOrder): boolean {
  if (order.syncStatus === "CANCELLED") return false;
  if (order.paymentStatus) {
    return order.paymentStatus !== "DRAFT" &&
      order.paymentStatus !== "REFUNDED";
  }
  return order.status !== "DRAFT";
}
