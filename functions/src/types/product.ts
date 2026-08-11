// =============================================================================
// Product Types — Cloud Functions (Sync from HK API)
// =============================================================================

/**
 * Category mapping from HK API numeric IDs to Vietnamese labels.
 * Used in both Cloud Functions (write) and Frontend (display).
 */
export const CATEGORY_MAP: Record<number, string> = {
  1: "Gói Xu",
  2: "Gói Điểm",
  4: "Vé & Combo",
  6: "Nạp Thẻ",
  10: "Sản phẩm lưu niệm",
};

/** Category IDs to sync from the HK API. */
export const SYNC_CATEGORY_IDS = [1, 2, 4, 6] as const;

/** POS-owned category used for sellable physical souvenir products. */
export const SOUVENIR_CATEGORY_ID = 10;

/**
 * A product document stored in Firestore `products/{goodsId}`.
 * Synced from HK API via the `syncProducts` Cloud Function.
 */
export interface SyncProduct {
  goodsId: string;
  goodsName: string;
  description?: string;
  /** Selling price before tax. */
  price: number;
  /** Authoritative consumer price after tax. */
  afterTaxPrice: number;
  /** Numeric POS category ID (1, 2, 4, 6, or 10 for souvenirs). */
  category: number;
  /** Sub-category name from HK API (if available) */
  subCategory: string;
  /** Text color used by HK for the product card. */
  foreColor?: string;
  /** Background color used by HK for the product card. */
  backColor?: string;
  /** Principal package value from HK `amount`. */
  principalPoints?: number;
  /** Bonus package value from the sum of HK `giveConfigs[].giveAmount`. */
  bonusPoints?: number;
  /** Number of physical tickets to print for one sold category-4 product. */
  ticketsPerUnit?: number;
  /** Current stock quantity for physical souvenir products. */
  amount?: number;
  /** HK product code for physical souvenir products. */
  giftNo?: string;
  /** HK product group name for physical souvenir products. */
  typeName?: string;
  /** ISO 8601 timestamp of last sync */
  lastSyncAt: string;
}
