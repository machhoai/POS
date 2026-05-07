// =============================================================================
// Product Service — Callable Cloud Functions for catalog sync
// =============================================================================

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";

/** Result returned by the syncProducts callable function. */
export interface SyncProductsResult {
  success: boolean;
  productCount: number;
  syncedAt: string;
}

/**
 * Trigger the HK_API sync through the backend Cloud Function.
 */
export async function syncProducts(): Promise<SyncProductsResult> {
  const callable = httpsCallable<undefined, SyncProductsResult>(
    functions,
    "syncProducts"
  );

  const result = await callable();
  return result.data;
}
