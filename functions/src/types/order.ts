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
  /** Tax-inclusive unit price charged to the customer. */
  price: number;
  quantity: number;
  /** Authoritative pre-tax unit price at order creation time. */
  unitPriceBeforeTax?: number;
  /** Derived tax percentage at order creation time. */
  taxRate?: number;
  /** Total tax amount for this line. */
  taxAmount?: number;
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
  /** Opaque bearer token encoded in the public invoice-request QR. */
  invoiceRequestToken?: string;
  /** ISO timestamp when the public invoice-request capability was created. */
  invoiceRequestCreatedAt?: string;
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
  /** Every PayOS order code ever created for this order, used by the webhook. */
  payosOrderCodes?: number[];
  paymentDetails?: PayOSPaymentDetails;
  sync: SyncMetadata;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}
