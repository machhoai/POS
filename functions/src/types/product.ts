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
};

/** Category IDs to sync from the HK API. */
export const SYNC_CATEGORY_IDS = [1, 2, 4, 6] as const;

/**
 * A product document stored in Firestore `products/{goodsId}`.
 * Synced from HK API via the `syncProducts` Cloud Function.
 */
export interface SyncProduct {
  goodsId: string;
  goodsName: string;
  description?: string;
  price: number;
  /** Numeric category ID from HK API (1, 2, 4, 6) */
  category: number;
  /** Sub-category name from HK API (if available) */
  subCategory: string;
  /** ISO 8601 timestamp of last sync */
  lastSyncAt: string;
}
