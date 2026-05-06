// =============================================================================
// HK Third-Party API Types (鲸舰 OpenAPI)
// =============================================================================
// Based on actual API documentation: 海外-鲸舰-OpenApi.md
// =============================================================================

/** Parameters required to generate the MD5 signature for HK API requests. */
export interface SignatureParams {
  appId: string;
  action: string;
  version: string;
  timestamp: string;
  bodyString: string;
  key: string;
}

/**
 * Supported API actions for the HK remote API.
 *
 * From docs:
 *   - order_precalculate: Pre-calculate order totals & discounts
 *   - order_create: Create a new order
 *   - order_pay: Confirm payment for an order
 *   - order_pay_query: Query payment status
 */
export type HKApiAction =
  | "order_precalculate"
  | "order_create"
  | "order_pay"
  | "order_pay_query";

/** The envelope wrapper POSTed to the HK API (`/openapi/action`). */
export interface HKApiRequest {
  appId: string;
  action: string;
  version: string;
  timestamp: string; // 13-digit millisecond timestamp
  sign: string;      // MD5 signature (UPPERCASE)
  body: string;      // JSON-stringified business parameters
}

/**
 * Standard response envelope from the HK API.
 *
 * From docs:
 * ```json
 * { "success": true, "msg": "", "code": 0, "data": { ... }, "desc": "" }
 * ```
 */
export interface HKApiResponse {
  success: boolean;
  code: number;
  msg: string;
  data: Record<string, unknown> | null;
  desc?: string;
}

/** Response data for `order_create` action. */
export interface OrderCreateResponseData {
  orderNumber: string;   // e.g., "O01325651772437086903635"
  totalAmount: number;
  discountAmount: number;
  actualPayment: number;
}

/** Response data for `order_pay` action. */
export interface OrderPayResponseData {
  orderNumber: string;
}

/** Response data for `order_pay_query` action. */
export interface OrderPayQueryResponseData {
  orderNumber: string;
  payStatus: number;
  // 0=待支付, 1=支付中, 2=已支付, 3=支付失败, 4=已取消, 5=已退款
  payStatusDesc: string;
}

/** Body parameters for `order_create`. */
export interface OrderCreateBody {
  Uid: string;  // Member UID (required)
  GoodsItems: Array<{
    GoodsId: string;   // Product ID (required)
    Quantity: string;  // Quantity as string (required)
  }>;
}

/** Body parameters for `order_pay`. */
export interface OrderPayBody {
  OrderNumber: string;       // Order number from order_create response
  PayAmount?: number | null;  // Optional, defaults to order total
}

/** Body parameters for `order_pay_query`. */
export interface OrderPayQueryBody {
  OrderNumber: string;
}
