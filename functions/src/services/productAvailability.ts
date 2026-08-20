import type {
  ProductDisabledReason,
  ProductSyncStatus,
  SyncProduct,
} from "../types/product";

export interface ProductAvailabilityInput {
  isEnabled?: boolean;
  isOpenSales?: boolean;
  isCategoryEnabled?: boolean;
  /** True only when the product appears in HK's current sellable catalog. */
  isSellable?: boolean;
}

export interface ProductAvailability {
  isEnabled: boolean;
  isOpenSales: boolean;
  isCategoryEnabled: boolean;
  syncStatus: ProductSyncStatus;
  disabledReason: ProductDisabledReason | null;
}

/**
 * Normalize HK's independent availability switches into the state persisted by
 * JPOS. A product must pass every switch and appear in the sellable catalog.
 */
export function resolveProductAvailability(
  input: ProductAvailabilityInput = {},
): ProductAvailability {
  const isEnabled = input.isEnabled !== false;
  const isCategoryEnabled = input.isCategoryEnabled !== false;
  const isOpenSales = input.isOpenSales !== false && input.isSellable !== false;

  let disabledReason: ProductDisabledReason | null = null;
  if (!isEnabled) {
    disabledReason = "product_disabled";
  } else if (!isCategoryEnabled) {
    disabledReason = "category_disabled";
  } else if (input.isOpenSales === false) {
    disabledReason = "sales_disabled";
  } else if (input.isSellable === false) {
    disabledReason = "not_sellable";
  }

  return {
    isEnabled,
    isOpenSales,
    isCategoryEnabled,
    syncStatus: disabledReason ? "disabled" : "active",
    disabledReason,
  };
}

/** Keep legacy documents visible until their first reconciled synchronization. */
export function isProductAvailable(
  product: Partial<SyncProduct>,
): boolean {
  return product.isEnabled !== false &&
    product.isOpenSales !== false &&
    product.isCategoryEnabled !== false &&
    product.syncStatus !== "disabled";
}

export interface RemoteDeletionEvidence {
  category: number;
  detailResponseCode?: number;
  detailResponseMessage?: string;
  managementCatalogIsAuthoritative?: boolean;
  managementCatalogContainsProduct?: boolean;
}

/** Only destructive evidence may remove a local Firestore product document. */
export function isConfirmedRemoteDeletion(
  evidence: RemoteDeletionEvidence,
): boolean {
  if (evidence.detailResponseCode === 404) {
    const message = (evidence.detailResponseMessage || "").toLowerCase();
    const reportsMissingEndpoint = message.includes("api") ||
      message.includes("action") ||
      message.includes("interface");
    if (!reportsMissingEndpoint) return true;
  }

  return evidence.managementCatalogIsAuthoritative === true &&
    evidence.managementCatalogContainsProduct === false;
}
