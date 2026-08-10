// =============================================================================
// Product Service — Callable Cloud Functions for catalog sync
// =============================================================================

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { withDeviceAuth } from "@/lib/services/deviceEnrollmentService";

/** Result returned by the syncProducts callable function. */
export interface SyncProductsResult {
  success: boolean;
  productCount: number;
  souvenirProductCount: number;
  removedSouvenirCount: number;
  syncedAt: string;
}

/** Product record returned by the authenticated backend catalog endpoint. */
export interface StoredProduct {
  goodsId: string;
  goodsName: string;
  description?: string;
  price: number;
  afterTaxPrice?: number;
  category: number;
  subCategory: string;
  foreColor?: string;
  backColor?: string;
  amount?: number;
  giftNo?: string;
  typeName?: string;
  lastSyncAt: string;
}

interface GetProductsResult {
  products: StoredProduct[];
  fetchedAt: string;
}

/** Load the product catalog through the backend without exposing Firestore. */
export async function getProducts(): Promise<GetProductsResult> {
  const callable = httpsCallable<
    { action: "getProducts" },
    GetProductsResult
  >(
    functions,
    "getPosAuthSession"
  );

  const result = await callable(
    await withDeviceAuth({ action: "getProducts" as const }),
  );
  return result.data;
}

/**
 * Trigger the HK_API sync through the backend Cloud Function.
 */
export async function syncProducts(): Promise<SyncProductsResult> {
  const callable = httpsCallable<
    { action: "syncProducts" },
    SyncProductsResult
  >(
    functions,
    "getPosAuthSession"
  );

  const result = await callable(
    await withDeviceAuth({ action: "syncProducts" as const }),
  );
  return result.data;
}
