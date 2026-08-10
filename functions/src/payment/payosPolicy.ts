import type { OrderStatus, PayOSPaymentStatus } from "../types/order";

export type PayOSNextAction =
  | "WAIT"
  | "RETRY_DISPLAY"
  | "RECREATE"
  | "FALLBACK"
  | "COMPLETED";

export const PAYOS_DISPLAY_WINDOW_MS = 5 * 60 * 1000;
export const MANUAL_CONFIRMATION_ERROR_WINDOW_MS = 10 * 60 * 1000;
export const PAYOS_DESCRIPTION_MAX_LENGTH = 25;
export const PAYOS_STORE_CODE_MAX_LENGTH = 6;
export const PAYOS_PAYMENT_REFERENCE_LENGTH = 12;

/**
 * Builds the bank-transfer description from the warehouse business code and
 * the stable suffix of the local order ID. The payment reference always has
 * priority; the warehouse code only uses the remaining space, up to 6 chars.
 */
export function buildPayOSPaymentDescription(
  warehouseCode: string,
  localOrderId: string,
): string {
  const paymentReference = localOrderId.slice(
    -Math.min(PAYOS_PAYMENT_REFERENCE_LENGTH, PAYOS_DESCRIPTION_MAX_LENGTH),
  );
  const availableStoreCodeLength = Math.max(
    0,
    PAYOS_DESCRIPTION_MAX_LENGTH - paymentReference.length - 1,
  );
  const storeCode = warehouseCode.trim().slice(
    0,
    Math.min(PAYOS_STORE_CODE_MAX_LENGTH, availableStoreCodeLength),
  );

  return storeCode ? `${storeCode} ${paymentReference}` : paymentReference;
}

export function isCompletedOrderStatus(status: OrderStatus): boolean {
  return ["LOCAL_PAID", "SYNCING", "SYNC_SUCCESS", "SYNC_FAILED"].includes(
    status,
  );
}

export function inferPayOSNextAction(input: {
  orderStatus: OrderStatus;
  paymentStatus?: PayOSPaymentStatus;
  linkExpiresAt?: string;
  displayExpiresAt?: string;
  nowMs: number;
}): PayOSNextAction {
  if (input.paymentStatus === "PAID" || isCompletedOrderStatus(input.orderStatus)) {
    return "COMPLETED";
  }
  if (
    !input.paymentStatus ||
    ["CANCELLED", "EXPIRED", "FAILED"].includes(input.paymentStatus) ||
    !input.linkExpiresAt ||
    !input.displayExpiresAt
  ) {
    return "RECREATE";
  }
  if (new Date(input.linkExpiresAt).getTime() <= input.nowMs) return "RECREATE";
  if (new Date(input.displayExpiresAt).getTime() <= input.nowMs) {
    return "RETRY_DISPLAY";
  }
  return "WAIT";
}

export function isPayOSPaymentAmountValid(
  expectedAmount: number,
  attemptAmount: number,
  paidAmount: number,
): boolean {
  return Number.isSafeInteger(paidAmount) &&
    paidAmount > 0 &&
    paidAmount === expectedAmount &&
    paidAmount === attemptAmount;
}

export type PayOSWebhookDecision =
  | "APPLY_PAYMENT"
  | "ALREADY_COMPLETED"
  | "REJECT";

export function decidePayOSWebhookPayment(input: {
  orderStatus: OrderStatus;
  expectedOrderCode: number;
  expectedPaymentLinkId?: string;
  expectedAmount: number;
  attemptAmount: number;
  webhookCode: string;
  webhookOrderCode: number;
  webhookPaymentLinkId: string;
  webhookAmount: number;
  webhookCurrency: string;
}): PayOSWebhookDecision {
  if (
    input.webhookCode !== "00" ||
    !Number.isSafeInteger(input.webhookOrderCode) ||
    input.webhookOrderCode <= 0 ||
    input.webhookOrderCode !== input.expectedOrderCode ||
    input.webhookCurrency !== "VND" ||
    (input.expectedPaymentLinkId !== undefined &&
      input.webhookPaymentLinkId !== input.expectedPaymentLinkId) ||
    !isPayOSPaymentAmountValid(
      input.expectedAmount,
      input.attemptAmount,
      input.webhookAmount,
    )
  ) {
    return "REJECT";
  }
  return isCompletedOrderStatus(input.orderStatus)
    ? "ALREADY_COMPLETED"
    : "APPLY_PAYMENT";
}

export function canManuallyConfirmPayOSPayment(input: {
  orderStatus: OrderStatus;
  isOrderCreator: boolean;
  paymentStatus?: PayOSPaymentStatus;
  lastConnectionErrorAt?: string;
  nowMs: number;
}): boolean {
  if (
    input.orderStatus !== "DRAFT" ||
    !input.isOrderCreator ||
    !input.paymentStatus ||
    input.paymentStatus === "PAID" ||
    !input.lastConnectionErrorAt
  ) {
    return false;
  }
  const errorAtMs = Date.parse(input.lastConnectionErrorAt);
  return Number.isFinite(errorAtMs) &&
    input.nowMs - errorAtMs >= 0 &&
    input.nowMs - errorAtMs <= MANUAL_CONFIRMATION_ERROR_WINDOW_MS;
}
