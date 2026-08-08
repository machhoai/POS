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
export type OrderKind = "STANDARD" | "MEMBER_PACKAGE";

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

export type PayOSPaymentStatus =
  | "CREATING"
  | "PENDING"
  | "PROCESSING"
  | "UNDERPAID"
  | "PAID"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED";

export interface PayOSPaymentAttempt {
  orderCode: number;
  status: PayOSPaymentStatus;
  amount: number;
  description: string;
  createdAt: string;
  linkExpiresAt: string;
  displayExpiresAt: string;
  paymentLinkId?: string;
  checkoutUrl?: string;
  qrCode?: string;
  bin?: string;
  accountNumber?: string;
  accountName?: string;
  currency?: string;
  updatedAt?: string;
  paidAt?: string;
  paidAmount?: number;
  reference?: string;
  transactionDateTime?: string;
  error?: string;
}

export interface PayOSPaymentDetails {
  provider: "payos";
  currentOrderCode: number;
  attempts: PayOSPaymentAttempt[];
  lastCheckedAt?: string;
  lastError?: string | null;
  lastConnectionErrorAt?: string;
  manualConfirmation?: PayOSManualConfirmation;
}

export interface PayOSManualConfirmation {
  confirmedAt: string;
  confirmedByUid: string;
  confirmedByName: string;
  reason: "PAYOS_UNAVAILABLE";
  note: string;
  previousPaymentStatus: PayOSPaymentStatus;
}

/** The POS order document in Firestore. */
export interface PosOrder {
  localOrderId: string;
  hkOrderNumber: string | null;
  /** Amount returned by order_create, retained for member-sale reconciliation. */
  remoteActualPayment?: number | null;
  shopId: number;
  warehouseId: string;
  createdBy: string;
  operatorId: string;
  operatorFirebaseUid: string;
  operatorName: string;
  /** Business flow; omitted on legacy orders and treated as STANDARD. */
  orderKind?: OrderKind;
  /** HK system member UID — required by the 鲸舰 API for order_create */
  uid?: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentMethodId: string;
  paymentMethodName: string;
  totalAmount: number;
  items: OrderItem[];
  /** Every PayOS order code ever created for this order, used by the webhook. */
  payosOrderCodes?: number[];
  paymentDetails?: PayOSPaymentDetails;
  sync: SyncMetadata;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}
