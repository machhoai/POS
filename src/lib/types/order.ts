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
  /** Giá bán một đơn vị đã bao gồm thuế. */
  price: number;
  quantity: number;
  /** Giá một đơn vị trước thuế, được chốt tại thời điểm tạo đơn. */
  unitPriceBeforeTax?: number;
  /** Thuế suất phần trăm được chốt tại thời điểm tạo đơn. */
  taxRate?: number;
  /** Tổng tiền thuế của dòng hàng. */
  taxAmount?: number;
}

/** Metadata tracking the sync process with the remote HK API. */
export interface SyncMetadata {
  retryCount: number;
  lastError: string | null;
  syncedAt: string | null; // ISO 8601 string
}

/** PayOS status stored locally for each generated payment link. */
export type PayOSPaymentStatus =
  | "CREATING"
  | "PENDING"
  | "PROCESSING"
  | "UNDERPAID"
  | "PAID"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED";

/** One PayOS QR attempt. Old attempts remain available for delayed webhooks. */
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

  /** Opaque bearer token encoded in the public invoice-request QR. */
  invoiceRequestToken?: string;

  /** ISO timestamp when the public invoice-request capability was created. */
  invoiceRequestCreatedAt?: string;

  /** The shop this order belongs to */
  shopId: number;

  /** Warehouse selected in the shared bduck-system session */
  warehouseId?: string;

  /** Firebase UID of the cashier who created the order */
  createdBy?: string;

  /** Operator identity recorded from the authenticated bduck-system user */
  operatorId?: string;
  operatorFirebaseUid?: string;
  operatorName?: string;

  /** Current status in the order lifecycle */
  status: OrderStatus;

  /** How the customer paid */
  paymentMethod: PaymentMethod;
  paymentMethodId?: string;
  paymentMethodName?: string;

  /** Total amount in the local currency */
  totalAmount: number;

  /** Line items in the order */
  items: OrderItem[];

  /** All PayOS order codes generated for webhook lookup. */
  payosOrderCodes?: number[];

  /** PayOS QR session data. Present only for transfer payments. */
  paymentDetails?: PayOSPaymentDetails;

  /** Tên khách hàng (nếu là thành viên) */
  customerName?: string;

  /** SĐT khách hàng (nếu là thành viên) */
  customerPhone?: string;

  /** Mã voucher đã áp dụng */
  voucherCode?: string;

  /** Số tiền giảm từ voucher */
  voucherDiscount?: number;

  /** Sync metadata for the background worker */
  sync: SyncMetadata;

  /** ISO 8601 timestamp when the order was created */
  createdAt: string;

  /** ISO 8601 timestamp when the order was last updated */
  updatedAt?: string;

  /** ISO 8601 timestamp when local payment completed */
  paidAt?: string;
}

/**
 * Fields required to create a new order.
 * `localOrderId`, `createdAt`, `sync`, `status`, and `hkOrderNumber` are auto-generated.
 */
export type CreateOrderInput = Pick<
  PosOrder,
  "shopId" | "paymentMethod" | "totalAmount" | "items"
>;
