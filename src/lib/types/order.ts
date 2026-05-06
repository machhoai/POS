// =============================================================================
// POS Order Types — Shared between frontend (Next.js) and backend (Cloud Functions)
// =============================================================================

/** Possible states an order can be in throughout its lifecycle. */
export type OrderStatus =
  | "DRAFT"        // Order is being built in the cashier's cart
  | "LOCAL_PAID"   // Payment completed locally, awaiting sync to HK API
  | "SYNCING"      // Currently being sent to the remote HK API
  | "SYNC_SUCCESS" // Successfully synced with HK API
  | "SYNC_FAILED"; // Sync attempt failed (will be retried)

/** Accepted payment methods at the POS terminal. */
export type PaymentMethod = "CASH" | "QR_CODE";

/** A single line item in an order. */
export interface OrderItem {
  goodsId: string;
  goodsName: string;
  price: number;
  quantity: number;
}

/** Metadata tracking the sync process with the remote HK API. */
export interface SyncMetadata {
  retryCount: number;
  lastError: string | null;
  syncedAt: string | null; // ISO 8601 string
}

/**
 * The primary order document stored in Firestore `pos_orders` collection.
 *
 * Lifecycle:
 *   DRAFT → LOCAL_PAID → SYNCING → SYNC_SUCCESS
 *                                 → SYNC_FAILED (retryable)
 */
export interface PosOrder {
  /** Unique local order ID, e.g., 'ORD-1715420000-001' */
  localOrderId: string;

  /** Order number returned by the HK API after successful sync */
  hkOrderNumber: string | null;

  /** The shop this order belongs to */
  shopId: number;

  /** Current status in the order lifecycle */
  status: OrderStatus;

  /** How the customer paid */
  paymentMethod: PaymentMethod;

  /** Total amount in the local currency */
  totalAmount: number;

  /** Line items in the order */
  items: OrderItem[];

  /** Sync metadata for the background worker */
  sync: SyncMetadata;

  /** ISO 8601 timestamp when the order was created */
  createdAt: string;
}

/**
 * Fields required to create a new order.
 * `localOrderId`, `createdAt`, `sync`, `status`, and `hkOrderNumber` are auto-generated.
 */
export type CreateOrderInput = Pick<
  PosOrder,
  "shopId" | "paymentMethod" | "totalAmount" | "items"
>;
