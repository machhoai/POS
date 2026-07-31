// =============================================================================
// POS Order Types — Shared interface (duplicated from frontend for isolation)
// =============================================================================
// Cloud Functions have their own node_modules and cannot import from the
// Next.js `src/` directory. This is a deliberate duplication to keep the
// two projects decoupled.
//
// If you add fields to the frontend PosOrder, update this file as well.
// =============================================================================

/** Order status lifecycle. */
export type OrderStatus =
  | "DRAFT"
  | "LOCAL_PAID"
  | "SYNCING"
  | "SYNC_SUCCESS"
  | "SYNC_FAILED";

/** Payment methods. */
export type PaymentMethod = "CASH" | "QR_CODE";

/** A single line item. */
export interface OrderItem {
  goodsId: string;
  goodsName: string;
  price: number;
  quantity: number;
}

/** Sync metadata. */
export interface SyncMetadata {
  retryCount: number;
  lastError: string | null;
  syncedAt: string | null;
}

/** The POS order document in Firestore. */
export interface PosOrder {
  localOrderId: string;
  hkOrderNumber: string | null;
  shopId: number;
  warehouseId: string;
  createdBy: string;
  operatorId: string;
  operatorFirebaseUid: string;
  operatorName: string;
  /** HK system member UID — required by the 鲸舰 API for order_create */
  uid?: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentMethodId: string;
  paymentMethodName: string;
  totalAmount: number;
  items: OrderItem[];
  sync: SyncMetadata;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}
