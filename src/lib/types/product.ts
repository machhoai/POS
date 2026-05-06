// =============================================================================
// Product Types — POS product catalog
// =============================================================================

/** Product category for organizing the product grid. */
export interface ProductCategory {
  id: string;
  name: string;
  sortOrder?: number;
}

/**
 * A product in the POS catalog.
 * Synced from the HK API via the syncProducts Cloud Function.
 */
export interface Product {
  /** Unique product ID from the HK system */
  goodsId: string;
  /** Display name */
  goodsName: string;
  /** Selling price in local currency */
  price: number;
  /** Product image URL (optional) */
  imageUrl?: string;
  /** Category for filtering in the product grid */
  categoryId?: string;
  /** Category name (denormalized for display) */
  categoryName?: string;
  /** Whether this product is available for sale */
  isActive: boolean;
  /** Stock quantity (0 = unlimited/not tracked) */
  stock?: number;
  /** Barcode for scanner support */
  barcode?: string;
  /** Sort order for display */
  sortOrder?: number;
}
