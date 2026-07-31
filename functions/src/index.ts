// =============================================================================
// Firebase Cloud Functions — POS Sync Worker
// =============================================================================
// This is the main entry point for all Cloud Functions in the POS system.
//
// Functions:
//   1. POS authentication callables (independent from the WMS API)
//   2. `syncProducts` — onCall function to sync product catalog from HK API
//   3. `onOrderLocalPaid` — Firestore trigger for order sync to HK API
// =============================================================================

export {
  getPosAuthSession,
  resolvePosLoginIdentifier,
} from "./auth/functions";

import {
  onDocumentUpdated,
  type Change,
  type FirestoreEvent,
} from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { db } from "./config/firebase";
import {
  createRemoteOrder,
  confirmRemotePayment,
  fetchGoodsByCategory,
  fetchSubscribeBaseList,
  fetchSouvenirStock,
} from "./services/hkApiService";
import type {
  HKGoodsItem,
  HKSouvenirStockItem,
} from "./services/hkApiService";
import { mapSellableSouvenirs } from "./services/productCatalog";
import type { PosOrder } from "./types/order";
import type { SyncProduct } from "./types/product";
import {
  SOUVENIR_CATEGORY_ID,
  SYNC_CATEGORY_IDS,
} from "./types/product";

// =============================================================================
// syncProducts — onCall Cloud Function
// =============================================================================
// Fetches package categories through `setmeal_getsellgoods` and physical
// souvenirs through `gift_realtime_stock`, then batch-writes all products to
// the Firestore `jpos_products` collection with docId = goodsId.
// =============================================================================

export const syncProducts = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn phải đăng nhập để đồng bộ sản phẩm."
      );
    }

    functions.logger.info(
      `[syncProducts] Bắt đầu đồng bộ sản phẩm bởi user ${request.auth.uid}`
    );

    try {
      const allProducts: SyncProduct[] = [];
      let synchronizedSouvenirIds: Set<string> | null = null;
      const now = new Date().toISOString();

      // ── Step 1: Fetch tickets/packages from oversea_subscribe_base_list ──
      functions.logger.info("[syncProducts] 🔍 Calling oversea_subscribe_base_list...");
      const subscribeResponse = await fetchSubscribeBaseList();
      functions.logger.info(
        "[syncProducts] 🔍 oversea_subscribe_base_list RAW RESPONSE:",
        {
          success: subscribeResponse.success,
          code: subscribeResponse.code,
          msg: subscribeResponse.msg,
          dataType: typeof subscribeResponse.data,
          dataKeys: subscribeResponse.data ? Object.keys(subscribeResponse.data) : [],
          rawData: JSON.stringify(subscribeResponse.data).substring(0, 3000),
        }
      );

      // Log first item if it's an array or has a list
      if (subscribeResponse.data) {
        const possibleList =
          Array.isArray(subscribeResponse.data) ? subscribeResponse.data :
          Array.isArray((subscribeResponse.data as Record<string, unknown>).list) ? (subscribeResponse.data as Record<string, unknown>).list as unknown[] :
          Array.isArray((subscribeResponse.data as Record<string, unknown>).data) ? (subscribeResponse.data as Record<string, unknown>).data as unknown[] :
          Array.isArray((subscribeResponse.data as Record<string, unknown>).items) ? (subscribeResponse.data as Record<string, unknown>).items as unknown[] :
          null;
        if (possibleList && possibleList.length > 0) {
          functions.logger.info(
            "[syncProducts] 🔍 FIRST SUBSCRIBE ITEM:",
            { item: JSON.stringify(possibleList[0]).substring(0, 1500) }
          );
          functions.logger.info(
            `[syncProducts] 🔍 Total subscribe items: ${possibleList.length}`
          );
        }
      }

      // ── Step 2: Fetch goods by category from setmeal_getsellgoods ──
      for (const categoryId of SYNC_CATEGORY_IDS) {
        functions.logger.info(
          `[syncProducts] Đang tải category ${categoryId}...`
        );

        const response = await fetchGoodsByCategory(categoryId);

        // 🔍 DEBUG: Log raw API response to identify field names
        functions.logger.info(
          `[syncProducts] 🔍 RAW response for category ${categoryId}:`,
          {
            success: response.success,
            code: response.code,
            msg: response.msg,
            dataType: typeof response.data,
            dataIsArray: Array.isArray(response.data),
            dataKeys: response.data ? Object.keys(response.data) : [],
            rawData: JSON.stringify(response.data).substring(0, 2000),
          }
        );

        if (!response.success) {
          functions.logger.warn(
            `[syncProducts] ⚠️ Category ${categoryId} trả về lỗi: ${response.msg}`
          );
          continue; // Skip this category, try the next one
        }

        // Extract goods list from response.data
        // HK API may return { data: [...] } or { data: { list: [...] } }
        const rawItems = extractGoodsList(response.data);

        // 🔍 DEBUG: Log first raw item to see exact field names
        if (rawItems.length > 0) {
          functions.logger.info(
            `[syncProducts] 🔍 FIRST RAW ITEM for category ${categoryId}:`,
            { item: JSON.stringify(rawItems[0]).substring(0, 1000) }
          );
        }

        for (const item of rawItems) {
          const goodsId = item.GoodsId || item.goodsId;
          if (!goodsId) continue;

          allProducts.push({
            goodsId,
            goodsName: item.GoodsName || item.goodsName || "Không rõ tên",
            description: item.Remark || item.remark || "",
            price: item.Price || item.price || 0,
            category: categoryId,
            subCategory: item.SubCategory || item.subCategory
              || item.CategoryGroupName || item.categoryGroupName || "",
            lastSyncAt: now,
          });
        }

        functions.logger.info(
          `[syncProducts] Category ${categoryId}: ${rawItems.length} sản phẩm`
        );
      }

      // ── Step 3: Fetch sellable physical souvenirs ─────────────────────
      functions.logger.info(
        "[syncProducts] Đang tải sản phẩm lưu niệm từ gift_realtime_stock..."
      );
      const souvenirResponse = await fetchSouvenirStock();

      if (!souvenirResponse.success) {
        functions.logger.warn(
          `[syncProducts] ⚠️ Không tải được sản phẩm lưu niệm: ${souvenirResponse.msg}`
        );
      } else {
        const rawSouvenirs = extractSouvenirList(souvenirResponse.data);
        const sellableSouvenirs = mapSellableSouvenirs(rawSouvenirs, now);
        allProducts.push(...sellableSouvenirs);

        if (rawSouvenirs.length > 0) {
          synchronizedSouvenirIds = new Set(
            sellableSouvenirs.map((product) => product.goodsId)
          );
        } else {
          functions.logger.warn(
            "[syncProducts] ⚠️ API trả về danh sách lưu niệm rỗng; bỏ qua dọn dữ liệu cũ để tránh xóa nhầm."
          );
        }

        functions.logger.info(
          `[syncProducts] Sản phẩm lưu niệm: ${sellableSouvenirs.length}/${rawSouvenirs.length} sản phẩm có giá bán`
        );
      }

      // Batch write to Firestore (max 500 per batch)
      const BATCH_LIMIT = 500;
      let totalWritten = 0;

      for (let i = 0; i < allProducts.length; i += BATCH_LIMIT) {
        const chunk = allProducts.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();

        for (const product of chunk) {
          const docRef = db.collection("jpos_products").doc(product.goodsId);
          batch.set(docRef, product, { merge: true });
        }

        await batch.commit();
        totalWritten += chunk.length;
      }

      // Remove legacy category-10 records that are no longer part of the
      // authoritative sellable souvenir result. Only clean up after a
      // successful, non-empty stock response to avoid destructive syncs when
      // the remote API unexpectedly returns an empty payload.
      let removedSouvenirCount = 0;
      if (synchronizedSouvenirIds) {
        const existingSouvenirs = await db
          .collection("jpos_products")
          .where("category", "==", SOUVENIR_CATEGORY_ID)
          .get();
        const staleSouvenirDocs = existingSouvenirs.docs.filter(
          (doc) => !synchronizedSouvenirIds.has(doc.id)
        );

        for (let i = 0; i < staleSouvenirDocs.length; i += BATCH_LIMIT) {
          const batch = db.batch();
          const chunk = staleSouvenirDocs.slice(i, i + BATCH_LIMIT);

          for (const doc of chunk) {
            batch.delete(doc.ref);
          }

          await batch.commit();
          removedSouvenirCount += chunk.length;
        }
      }

      functions.logger.info(
        `[syncProducts] ✅ Đồng bộ thành công ${totalWritten} sản phẩm; đã xóa ${removedSouvenirCount} sản phẩm lưu niệm cũ`
      );

      return {
        success: true,
        productCount: totalWritten,
        removedSouvenirCount,
        syncedAt: now,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      functions.logger.error(
        `[syncProducts] ❌ Đồng bộ thất bại: ${errorMessage}`
      );
      throw new HttpsError(
        "internal",
        "Đồng bộ sản phẩm thất bại. Vui lòng thử lại."
      );
    }
  }
);

/**
 * Extract the goods list array from the HK API response data.
 * Handles multiple possible response shapes defensively.
 */
function extractGoodsList(
  data: Record<string, unknown> | null
): HKGoodsItem[] {
  if (!data) return [];

  // Shape 1: data is an array directly
  if (Array.isArray(data)) return data as HKGoodsItem[];

  // Shape 2: { list: [...] }
  if (Array.isArray(data.list)) return data.list as HKGoodsItem[];

  // Shape 3: { data: [...] }
  if (Array.isArray(data.data)) return data.data as HKGoodsItem[];

  // Shape 4: { goodsItems: [...] }
  if (Array.isArray(data.goodsItems)) return data.goodsItems as HKGoodsItem[];

  // Shape 5: { items: [...] }
  if (Array.isArray(data.items)) return data.items as HKGoodsItem[];

  return [];
}

/**
 * Extract the physical-stock list returned by `gift_realtime_stock`.
 */
function extractSouvenirList(
  data: Record<string, unknown> | null
): HKSouvenirStockItem[] {
  if (!data) return [];

  if (Array.isArray(data)) return data as HKSouvenirStockItem[];
  if (Array.isArray(data.list)) return data.list as HKSouvenirStockItem[];
  if (Array.isArray(data.data)) return data.data as HKSouvenirStockItem[];
  if (Array.isArray(data.items)) return data.items as HKSouvenirStockItem[];

  return [];
}


// =============================================================================
// onOrderLocalPaid — Firestore Trigger
// =============================================================================

/**
 * Firestore Trigger: Fires when any document in `pos_orders` is updated.
 *
 * We check if the status has changed to "LOCAL_PAID" and then kick off
 * the background sync process with the HK remote API.
 */
export const onOrderLocalPaid = onDocumentUpdated(
  { document: "pos_orders/{orderId}", region: "asia-southeast1" },
  async (
    event: FirestoreEvent<
      Change<functions.firestore.QueryDocumentSnapshot> | undefined,
      { orderId: string }
    >
  ) => {
    // Safety: ensure event data exists
    if (!event.data) {
      functions.logger.warn("[Sync] Event fired with no data, skipping.");
      return;
    }

    const beforeData = event.data.before.data() as PosOrder;
    const afterData = event.data.after.data() as PosOrder;
    const orderId = event.params.orderId;

    // ── Guard: Only process transitions TO "LOCAL_PAID" ──────────────────
    if (beforeData.status === afterData.status) {
      return; // No status change
    }

    if (afterData.status !== "LOCAL_PAID") {
      return; // Not the transition we care about
    }

    functions.logger.info(
      `[Sync] Order ${orderId} transitioned to LOCAL_PAID. Starting sync...`
    );

    const docRef = db.collection("pos_orders").doc(orderId);

    try {
      // Step 1: Mark as SYNCING
      await docRef.update({ status: "SYNCING" });

      // Step 2: Create order on HK remote system (order_create)
      // The HK API expects: Uid (member ID) + GoodsItems[{GoodsId, Quantity}]
      functions.logger.info(`[Sync] Calling order_create for ${orderId}...`);
      const createResponse = await createRemoteOrder({
        uid: afterData.uid || "",
        goodsItems: afterData.items.map((item) => ({
          goodsId: item.goodsId,
          quantity: String(item.quantity),
        })),
      });

      if (!createResponse.success) {
        throw new Error(
          `order_create failed: [${createResponse.code}] ${createResponse.msg}`
        );
      }

      const hkOrderNumber = (createResponse.data?.orderNumber as string) || null;
      functions.logger.info(
        `[Sync] order_create success. HK Order: ${hkOrderNumber}`
      );

      // Step 3: Confirm payment on HK remote system (order_pay)
      functions.logger.info(`[Sync] Calling order_pay for ${orderId}...`);
      const payResponse = await confirmRemotePayment({
        orderNumber: hkOrderNumber || "",
        payAmount: afterData.totalAmount,
      });

      if (!payResponse.success) {
        throw new Error(
          `order_pay failed: [${payResponse.code}] ${payResponse.msg}`
        );
      }

      functions.logger.info(`[Sync] order_pay success for ${orderId}.`);

      // Step 4: Mark as SYNC_SUCCESS
      await docRef.update({
        status: "SYNC_SUCCESS",
        hkOrderNumber,
        sync: {
          retryCount: afterData.sync?.retryCount || 0,
          lastError: null,
          syncedAt: new Date().toISOString(),
        },
      });

      functions.logger.info(
        `[Sync] ✅ Order ${orderId} synced successfully as ${hkOrderNumber}.`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      functions.logger.error(
        `[Sync] ❌ Order ${orderId} sync failed: ${errorMessage}`
      );

      // Mark as SYNC_FAILED with error details
      const currentRetryCount = afterData.sync?.retryCount || 0;
      await docRef.update({
        status: "SYNC_FAILED",
        sync: {
          retryCount: currentRetryCount + 1,
          lastError: errorMessage,
          syncedAt: null,
        },
      });
    }
  }
);

/**
 * Scheduled Function: Retry failed syncs.
 * Runs every 5 minutes to pick up SYNC_FAILED orders and retry them.
 *
 * To enable, uncomment and configure in firebase.json:
 * "functions": { "schedule": "every 5 minutes" }
 */
// export const retryFailedSyncs = onSchedule("every 5 minutes", async () => {
//   const failedOrders = await db
//     .collection("pos_orders")
//     .where("status", "==", "SYNC_FAILED")
//     .where("sync.retryCount", "<", 5) // Max 5 retries
//     .get();
//
//   functions.logger.info(
//     `[Retry] Found ${failedOrders.size} failed orders to retry.`
//   );
//
//   for (const doc of failedOrders.docs) {
//     // Reset to LOCAL_PAID to re-trigger the onOrderLocalPaid function
//     await doc.ref.update({ status: "LOCAL_PAID" });
//   }
// });
