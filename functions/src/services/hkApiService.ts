// =============================================================================
// HK API Service — Handles communication with the remote 鲸舰 API
// =============================================================================
// This service sends signed requests to the HK API for order creation and
// payment confirmation. Uses `generateHkApiRequest` from the signature utility
// to build signed envelopes.
//
// Mock mode: When HK_API_BASE_URL is empty or contains "[REMOTE_API_DOMAIN]",
// returns simulated success responses for local development.
//
// Reference: 海外-鲸舰-OpenApi.md → § 订单
// =============================================================================

import { generateHkApiRequest } from "../utils/hk-signature";
import * as functions from "firebase-functions";

// =============================================================================
// Response Types (matching real API shape)
// =============================================================================

/** Standard response from the HK API. */
interface HKApiResponse {
  success: boolean;
  code: number;
  msg: string;
  data: Record<string, unknown> | null;
  desc?: string;
}

// =============================================================================
// Internal: Send signed request
// =============================================================================

/**
 * Determine if mock mode is active.
 * Mock mode is used when no real API URL is configured.
 */
function isMockMode(): boolean {
  const baseUrl = process.env.HK_API_BASE_URL;
  return !baseUrl || baseUrl.includes("[REMOTE_API_DOMAIN]");
}

/**
 * Send a signed request to the HK API.
 *
 * @param action - The API action name (e.g., "order_create").
 * @param body - The business parameters object.
 * @returns The parsed API response.
 */
async function sendToHKApi(
  action: string,
  body: Record<string, unknown>,
  version?: string
): Promise<HKApiResponse> {
  const signedRequest = generateHkApiRequest({ action, body, version });

  if (isMockMode()) {
    // ── MOCK MODE ──────────────────────────────────────────────────────────
    functions.logger.info(
      `[HK API Mock] Action: ${action}`,
      {
        appId: signedRequest.appId,
        sign: signedRequest.sign,
        timestamp: signedRequest.timestamp,
        bodyPreview: signedRequest.body.substring(0, 200),
      }
    );

    // Return mock success responses based on action
    switch (action) {
      case "order_precalculate":
        return {
          success: true,
          msg: "",
          code: 0,
          data: {
            totalOriginalMoney: 100,
            totalDiscountMoney: 0,
            totalMoney: 100,
            totalQty: 1,
            goodsList: [],
          },
          desc: "Mock response",
        };

      case "order_create":
        return {
          success: true,
          msg: "",
          code: 0,
          data: {
            orderNumber: `O-MOCK-${Date.now()}`,
            totalAmount: 100,
            discountAmount: 0,
            actualPayment: 100,
          },
          desc: "Mock response",
        };

      case "order_pay":
        return {
          success: true,
          msg: "",
          code: 0,
          data: {
            orderNumber: (body.OrderNumber as string) || `O-MOCK-${Date.now()}`,
          },
          desc: "Mock response",
        };

      case "order_pay_query":
        return {
          success: true,
          msg: "",
          code: 0,
          data: {
            orderNumber: (body.OrderNumber as string) || "",
            payStatus: 2,
            payStatusDesc: "已支付",
          },
          desc: "Mock response",
        };

      case "gift_realtime_stock":
        return {
          success: true,
          msg: "",
          code: 0,
          data: { items: [] },
          desc: "Mock response",
        };

      default:
        return {
          success: true,
          msg: "",
          code: 0,
          data: {},
          desc: "Mock response (unknown action)",
        };
    }
  }

  // ── REAL API CALL ──────────────────────────────────────────────────────
  const baseUrl = process.env.HK_API_BASE_URL!;

  functions.logger.info(`[HK API] Sending ${action} to ${baseUrl}`, {
    sign: signedRequest.sign,
    timestamp: signedRequest.timestamp,
  });

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signedRequest),
  });

  if (!response.ok) {
    throw new Error(
      `HK API HTTP error: ${response.status} ${response.statusText}`
    );
  }

  const result = (await response.json()) as HKApiResponse;

  functions.logger.info(`[HK API] Response for ${action}:`, {
    success: result.success,
    code: result.code,
    msg: result.msg,
  });

  return result;
}

// =============================================================================
// Public API Methods
// =============================================================================

/**
 * Pre-calculate order totals and discounts.
 * Action: `order_precalculate`
 *
 * @param params - Uid and GoodsItems.
 * @returns Calculated totals from the HK system.
 */
export async function precalculateOrder(params: {
  uid?: string;
  goodsItems: Array<{ goodsId: string; quantity: string }>;
}): Promise<HKApiResponse> {
  return sendToHKApi("order_precalculate", {
    Uid: params.uid || "",
    GoodsItems: params.goodsItems.map((item) => ({
      GoodsId: item.goodsId,
      Quantity: item.quantity,
    })),
  });
}

/**
 * Create an order on the HK remote system.
 * Action: `order_create`
 *
 * @param params - Member UID and goods items.
 * @returns Response with `data.orderNumber`, `data.totalAmount`, etc.
 */
export async function createRemoteOrder(params: {
  uid: string;
  goodsItems: Array<{ goodsId: string; quantity: string }>;
}): Promise<HKApiResponse> {
  return sendToHKApi("order_create", {
    Uid: params.uid,
    GoodsItems: params.goodsItems.map((item) => ({
      GoodsId: item.goodsId,
      Quantity: item.quantity,
    })),
  });
}

/**
 * Confirm payment for an order on the HK remote system.
 * Action: `order_pay`
 *
 * @param params - Order number and optional payment amount.
 * @returns Response confirming payment.
 */
export async function confirmRemotePayment(params: {
  orderNumber: string;
  payAmount?: number | null;
}): Promise<HKApiResponse> {
  return sendToHKApi("order_pay", {
    OrderNumber: params.orderNumber,
    PayAmount: params.payAmount ?? null,
  });
}

/**
 * Query the payment status of an order.
 * Action: `order_pay_query`
 *
 * @param params - Order number to query.
 * @returns Response with `data.payStatus` (0-5) and `data.payStatusDesc`.
 */
export async function queryPaymentStatus(params: {
  orderNumber: string;
}): Promise<HKApiResponse> {
  return sendToHKApi("order_pay_query", {
    OrderNumber: params.orderNumber,
  });
}

// =============================================================================
// Product Catalog
// =============================================================================

/** Raw product item shape from the HK API response. */
export interface HKGoodsItem {
  GoodsId?: string;
  goodsId?: string;
  GoodsName?: string;
  goodsName?: string;
  Price?: number | string;
  price?: number | string;
  AfterTaxPrice?: number | string;
  afterTaxPrice?: number | string;
  Remark?: string;
  remark?: string;
  SubCategory?: string | number;
  subCategory?: string | number;
  CategoryGroupName?: string;
  categoryGroupName?: string;
}

/** Product classification returned by `setmeal_type_select`. */
export interface HKSetmealType {
  key?: string;
  Key?: string;
  typeId?: string;
  TypeId?: string;
  value?: string;
  Value?: string;
  typeName?: string;
  TypeName?: string;
}

/** Raw physical product returned by `gift_realtime_stock`. */
export interface HKSouvenirStockItem {
  GiftName?: string;
  giftName?: string;
  GiftNo?: string;
  giftNo?: string;
  TypeName?: string;
  typeName?: string;
  Amount?: number | string;
  amount?: number | string;
  GiftPrice?: number | string;
  giftPrice?: number | string;
  Price?: number | string;
  price?: number | string;
}

/**
 * Fetch sell-goods by category from the HK API.
 * Action: `setmeal_getsellgoods`
 *
 * @param category - The numeric category ID (1, 2, 4, 6).
 * @returns Response with goods data for the given category.
 */
export async function fetchGoodsByCategory(
  category: number,
  typeId?: string
): Promise<HKApiResponse> {
  return sendToHKApi("setmeal_getsellgoods", {
    Category: String(category),
    ...(typeId ? { TypeId: typeId } : {}),
  });
}

/**
 * Fetch package/ticket classifications from the HK API.
 * Action: `setmeal_type_select`
 */
export async function fetchSetmealTypes(): Promise<HKApiResponse> {
  return sendToHKApi("setmeal_type_select", {});
}

/**
 * Fetch ticket/package list from the HK API.
 * Action: `oversea_subscribe_base_list`
 *
 * @param category - Optional category filter (4 = Vé, etc.)
 * @returns Response with ticket/package data.
 */
export async function fetchSubscribeBaseList(
  category?: number
): Promise<HKApiResponse> {
  const body: Record<string, unknown> = { page: 1, limit: 99999 };
  if (category !== undefined) {
    body.category = category;
  }
  return sendToHKApi("oversea_subscribe_base_list", body);
}

/**
 * Fetch physical products with their current stock and sale price.
 * Action: `gift_realtime_stock`
 *
 * The response's `price` is the sale price. `giftPrice` is the purchase unit
 * price and must not be used as the POS selling price.
 */
export async function fetchSouvenirStock(): Promise<HKApiResponse> {
  return sendToHKApi(
    "gift_realtime_stock",
    { isFilterZero: true },
    "10.11.8"
  );
}
