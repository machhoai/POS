// =============================================================================
// Product Types — POS product catalog
// =============================================================================

/**
 * Category mapping from HK API numeric IDs to Vietnamese labels.
 * Shared constant used in UI tabs and product cards.
 */
export const CATEGORY_MAP: Record<number, string> = {
  1: "Gói Xu",
  2: "Gói Điểm",
  4: "Vé & Combo",
  6: "Nạp Thẻ",
};

/** All category IDs in display order. */
export const CATEGORY_IDS = [1, 2, 4, 6] as const;

/**
 * A product in the POS catalog.
 * Synced from the HK API via the syncProducts Cloud Function.
 * Stored in Firestore `jpos_products/{goodsId}`.
 */
export interface Product {
  /** Unique product ID from the HK system */
  goodsId: string;
  /** Display name */
  goodsName: string;
  /** Product description from HK API remark field */
  description?: string;
  /** Selling price in local currency */
  price: number;
  /** Numeric category ID from HK API (1, 2, 4, 6) */
  category: number;
  /** Sub-category name from HK API (if available) */
  subCategory: string;
  /** ISO 8601 timestamp of last sync */
  lastSyncAt?: string;
}
