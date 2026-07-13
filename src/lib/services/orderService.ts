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

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type {
  PosOrder,
  OrderStatus,
  CreateOrderInput,
} from "@/lib/types/order";

/** Firestore collection name for POS orders. */
const COLLECTION_NAME = "pos_orders";

/** Reference to the pos_orders collection. */
const ordersRef = collection(db, COLLECTION_NAME);

/**
 * Generate a unique local order ID using timestamp and a random suffix.
 * Format: ORD-{unix_seconds}-{3_digit_random}
 *
 * @example "ORD-1715420000-042"
 */
function generateLocalOrderId(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const suffix = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `ORD-${timestamp}-${suffix}`;
}

/**
 * Create a new order in Firestore with initial DRAFT status.
 *
 * @param input - The order data (shopId, paymentMethod, totalAmount, items).
 * @returns The generated `localOrderId` for tracking.
 */
export async function createLocalOrder(input: CreateOrderInput): Promise<string> {
  const localOrderId = generateLocalOrderId();

  const order: PosOrder = {
    localOrderId,
    hkOrderNumber: null,
    shopId: input.shopId,
    status: "DRAFT",
    paymentMethod: input.paymentMethod,
    totalAmount: input.totalAmount,
    items: input.items,
    sync: {
      retryCount: 0,
      lastError: null,
      syncedAt: null,
    },
    createdAt: new Date().toISOString(),
  };

  // Use the localOrderId as the document ID for easy lookups
  const docRef = doc(db, COLLECTION_NAME, localOrderId);
  await setDoc(docRef, order);

  return localOrderId;
}

/**
 * Update an order's status and optionally merge additional fields.
 *
 * @param localOrderId - The document ID / local order ID.
 * @param status - The new status to set.
 * @param extra - Optional additional fields to merge (e.g., sync metadata).
 */
export async function updateOrderStatus(
  localOrderId: string,
  status: OrderStatus,
  extra?: Partial<Pick<PosOrder, "hkOrderNumber" | "sync">>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, localOrderId);

  const updateData: Record<string, unknown> = { status };

  if (extra?.hkOrderNumber !== undefined) {
    updateData.hkOrderNumber = extra.hkOrderNumber;
  }
  if (extra?.sync !== undefined) {
    updateData.sync = extra.sync;
  }

  await updateDoc(docRef, updateData);
}

/**
 * Subscribe to the current DRAFT order for a specific shop.
 * Used by the Customer Display to mirror the cashier's cart in real-time.
 *
 * @param shopId - The shop to filter by.
 * @param callback - Fires whenever the draft order changes.
 * @returns An unsubscribe function to stop listening.
 */
export function subscribeToCurrentDraft(
  shopId: number,
  callback: (order: PosOrder | null) => void
): Unsubscribe {
  const q = query(
    ordersRef,
    where("shopId", "==", shopId),
    where("status", "==", "DRAFT"),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
      return;
    }
    const doc = snapshot.docs[0];
    callback(doc.data() as PosOrder);
  });
}

/**
 * Subscribe to the most recent order for a shop (any status).
 * Used by the Customer Display to show success/payment screens.
 *
 * @param shopId - The shop to filter by.
 * @param callback - Fires whenever the latest order changes.
 * @returns An unsubscribe function to stop listening.
 */
export function subscribeToLatestOrder(
  shopId: number,
  callback: (order: PosOrder | null) => void
): Unsubscribe {
  const q = query(
    ordersRef,
    where("shopId", "==", shopId),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
      return;
    }
    const doc = snapshot.docs[0];
    callback(doc.data() as PosOrder);
  });
}

/**
 * Fetch all orders with a specific status.
 * Primarily used by the sync worker to find LOCAL_PAID orders.
 *
 * @param status - The order status to filter by.
 * @returns Array of matching orders.
 */
export async function getOrdersByStatus(status: OrderStatus): Promise<PosOrder[]> {
  const q = query(ordersRef, where("status", "==", status));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as PosOrder);
}
