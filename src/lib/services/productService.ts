// =============================================================================
// Product Service — Callable Cloud Functions for catalog sync
// =============================================================================

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";

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

  const result = await callable({ action: "getProducts" });
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

  const result = await callable({ action: "syncProducts" });
  return result.data;
}
