import type { OrderStatus } from "../types/order";

/**
 * Remote synchronization starts only after a locally verified payment.
 * Creating or refreshing a PayOS QR keeps the order in DRAFT and returns false.
 */
export function shouldSynchronizeRemoteOrder(
  beforeStatus: OrderStatus,
  afterStatus: OrderStatus,
): boolean {
  return beforeStatus !== afterStatus && afterStatus === "LOCAL_PAID";
}
