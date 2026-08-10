import type { OrderKind, OrderStatus } from "../types/order";

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
