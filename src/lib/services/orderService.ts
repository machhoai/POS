// =============================================================================
// Firestore Order Service — Client-side CRUD & Real-time Subscriptions
// =============================================================================
// This service operates on the `pos_orders` Firestore collection using the
// Firebase Client SDK. It provides:
//   - Order creation with auto-generated IDs and timestamps
//   - Real-time subscription for the customer display (onSnapshot)
//   - Status updates for the order lifecycle
//   - Querying orders by status
// =============================================================================

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import type {
  PosOrder,
  OrderStatus,
  OrderItem,
  PaymentMethod,
} from "@/lib/types/order";

type Unsubscribe = () => void;

/**
 * Generate a unique local order ID using timestamp and a random suffix.
 * Format: ORD-{unix_seconds}-{3_digit_random}
 *
 * @example "ORD-1715420000-042"
 */
export function generateLocalOrderId(): string {
  const timestamp = Date.now();
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `ORD-${timestamp}-${suffix}`;
}

interface OrderRequest {
  localOrderId: string;
  shopId: number;
  warehouseId: string;
  items: Array<Pick<OrderItem, "goodsId" | "quantity">>;
}

interface PreparedOrderResult {
  localOrderId: string;
  status: OrderStatus;
  totalAmount: number;
}

export interface CheckoutOrderResult extends PreparedOrderResult {
  hkOrderNumber: string | null;
  paidAt: string | null;
}

export interface OrderSyncStatusResult {
  localOrderId: string;
  hkOrderNumber: string | null;
  status: OrderStatus;
  totalAmount: number;
  lastError: string | null;
  updatedAt: string;
}

/** Create a Firebase draft through the authenticated backend. */
export async function prepareOrder(
  input: OrderRequest,
): Promise<PreparedOrderResult> {
  const callable = httpsCallable<
    { action: "prepareOrder"; payload: OrderRequest },
    PreparedOrderResult
  >(
    functions,
    "getPosAuthSession",
  );
  const result = await callable({ action: "prepareOrder", payload: input });
  return result.data;
}

/** Commit local payment without waiting for the remote China API. */
export async function checkoutOrder(
  input: OrderRequest & { paymentMethodId: PaymentMethod },
): Promise<CheckoutOrderResult> {
  const callable = httpsCallable<
    {
      action: "checkoutOrder";
      payload: OrderRequest & { paymentMethodId: PaymentMethod };
    },
    CheckoutOrderResult
  >(functions, "getPosAuthSession");
  const result = await callable({ action: "checkoutOrder", payload: input });
  return result.data;
}

/** Read background synchronization status without direct Firestore access. */
export async function fetchOrderSyncStatus(
  localOrderId: string,
): Promise<OrderSyncStatusResult> {
  const callable = httpsCallable<
    {
      action: "getOrderStatus";
      payload: { localOrderId: string };
    },
    OrderSyncStatusResult
  >(functions, "getPosAuthSession");
  const result = await callable({
    action: "getOrderStatus",
    payload: { localOrderId },
  });
  return result.data;
}

export interface OrderHistoryResult {
  orders: PosOrder[];
  fetchedAt: string;
}

export async function fetchOrderHistory(
  requestedLimit = 500,
): Promise<OrderHistoryResult> {
  const callable = httpsCallable<
    { action: "getOrders"; payload: { limit: number } },
    OrderHistoryResult
  >(functions, "getPosAuthSession");
  const result = await callable({
    action: "getOrders",
    payload: { limit: requestedLimit },
  });
  return result.data;
}

async function fetchLatestOrder(
  shopId: number,
  status?: "DRAFT",
): Promise<PosOrder | null> {
  const callable = httpsCallable<
    {
      action: "getLatestOrder";
      payload: { shopId: number; status?: "DRAFT" };
    },
    { order: PosOrder | null }
  >(functions, "getPosAuthSession");
  const result = await callable({
    action: "getLatestOrder",
    payload: { shopId, ...(status ? { status } : {}) },
  });
  return result.data.order;
}

function subscribeByPolling(
  shopId: number,
  callback: (order: PosOrder | null) => void,
  status?: "DRAFT",
): Unsubscribe {
  let isActive = true;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const poll = async () => {
    try {
      const order = await fetchLatestOrder(shopId, status);
      if (isActive) callback(order);
    } catch (error: unknown) {
      console.error("[Đơn hàng] Không thể cập nhật màn hình khách:", error);
    } finally {
      if (isActive) timeoutId = setTimeout(poll, 2000);
    }
  };

  void poll();
  return () => {
    isActive = false;
    if (timeoutId) clearTimeout(timeoutId);
  };
}

export function subscribeToCurrentDraft(
  shopId: number,
  callback: (order: PosOrder | null) => void,
): Unsubscribe {
  return subscribeByPolling(shopId, callback, "DRAFT");
}

export function subscribeToLatestOrder(
  shopId: number,
  callback: (order: PosOrder | null) => void,
): Unsubscribe {
  return subscribeByPolling(shopId, callback);
}

export async function retryOrderSync(
  localOrderId: string,
): Promise<{ localOrderId: string; status: OrderStatus; queued: boolean }> {
  const callable = httpsCallable<
    {
      action: "retryOrderSync";
      payload: { localOrderId: string };
    },
    { localOrderId: string; status: OrderStatus; queued: boolean }
  >(functions, "getPosAuthSession");
  const result = await callable({
    action: "retryOrderSync",
    payload: { localOrderId },
  });
  return result.data;
}

export async function getOrdersByStatus(
  status: OrderStatus,
): Promise<PosOrder[]> {
  const result = await fetchOrderHistory();
  return result.orders.filter((order) => order.status === status);
}
