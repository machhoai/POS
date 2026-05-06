// =============================================================================
// Product Types — Cloud Functions (duplicated from frontend for isolation)
// =============================================================================

/** A product in the POS catalog. */
export interface PosProduct {
  goodsId: string;
  goodsName: string;
  price: number;
  imageUrl?: string;
  categoryId?: string;
  categoryName?: string;
  isActive: boolean;
  stock?: number;
  barcode?: string;
  sortOrder?: number;
  storeId: string;
  lastSyncAt: string;
}
