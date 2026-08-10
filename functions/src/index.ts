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
export {
  onOrderLocalPaid,
  retryFailedOrderSyncs,
} from "./order/functions";
export { payosWebhook } from "./payment/payosWebhook";
export { payosPayment } from "./payment/payosCallable";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { db } from "./config/firebase";
import { POS_COLLECTIONS } from "./config/collections";
import {
  fetchGoodsByCategory,
  fetchSubscribeBaseList,
} from "./services/hkApiService";
import type { HKGoodsItem } from "./services/hkApiService";
import {
  fetchSouvenirCatalog,
  joyworldPassSecret,
  joyworldUserSecret,
} from "./services/joyworldCatalogService";
import { mapSellableSouvenirs } from "./services/productCatalog";
import { assertActivePosDevice } from "./services/posDeviceAccessService";
import type { SyncProduct } from "./types/product";
import {
  SOUVENIR_CATEGORY_ID,
  SYNC_CATEGORY_IDS,
} from "./types/product";

// =============================================================================
// getPosProducts — authenticated, read-only product catalog
// =============================================================================

export const getPosProducts = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    await assertActivePosDevice(request.data);
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn phải đăng nhập để tải danh sách sản phẩm."
      );
    }

    const snapshot = await db.collection(POS_COLLECTIONS.products).get();
    const products: SyncProduct[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data() as Partial<SyncProduct>;
      const price = Number(data.price);
      const storedAfterTaxPrice = Number(data.afterTaxPrice);
      const afterTaxPrice = Number.isFinite(storedAfterTaxPrice)
        ? storedAfterTaxPrice
        : price;
      const category = Number(data.category);

      if (
        !data.goodsName ||
        !Number.isFinite(price) ||
        !Number.isFinite(afterTaxPrice) ||
        !Number.isFinite(category)
      ) {
        continue;
      }

      // Souvenirs without a sale price are not sellable POS products.
      if (category === SOUVENIR_CATEGORY_ID && afterTaxPrice <= 0) {
        continue;
      }

      products.push({
        goodsId: String(data.goodsId || doc.id),
        goodsName: String(data.goodsName),
        description: data.description ? String(data.description) : "",
        price,
        afterTaxPrice,
        category,
        subCategory: data.subCategory ? String(data.subCategory) : "",
        amount: Number.isFinite(Number(data.amount))
          ? Number(data.amount)
          : undefined,
        giftNo: data.giftNo ? String(data.giftNo) : undefined,
        typeName: data.typeName ? String(data.typeName) : undefined,
        lastSyncAt: data.lastSyncAt ? String(data.lastSyncAt) : "",
      });
    }

    return {
      products,
      fetchedAt: new Date().toISOString(),
    };
  }
);

// =============================================================================
// syncProducts — onCall Cloud Function
// =============================================================================
// Fetches package categories through `setmeal_getsellgoods` and physical
// souvenirs through the JoyWorld manager catalog, then batch-writes products to
// the Firestore `jpos_products` collection with docId = goodsId.
// =============================================================================

export const syncProducts = onCall(
  {
    region: "asia-southeast1",
    cors: true,
    secrets: [joyworldUserSecret, joyworldPassSecret],
  },
  async (request) => {
    await assertActivePosDevice(request.data);
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
            price: Number(item.Price ?? item.price ?? 0),
            afterTaxPrice: Number(
              item.AfterTaxPrice ??
              item.afterTaxPrice ??
              item.Price ??
              item.price ??
              0,
            ),
            category: categoryId,
            subCategory: String(
              item.SubCategory ||
              item.subCategory ||
              item.CategoryGroupName ||
              item.categoryGroupName ||
              "",
            ),
            lastSyncAt: now,
          });
        }

        functions.logger.info(
          `[syncProducts] Category ${categoryId}: ${rawItems.length} sản phẩm`
        );
      }

      // ── Step 3: Fetch sellable physical souvenirs ─────────────────────
      functions.logger.info(
        "[syncProducts] Đang tải sản phẩm lưu niệm từ JoyWorld manager catalog..."
      );
      {
        const rawSouvenirs = await fetchSouvenirCatalog();
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
          const docRef = db
            .collection(POS_COLLECTIONS.products)
            .doc(product.goodsId);
          batch.set(docRef, product, { merge: true });
        }

        await batch.commit();
        totalWritten += chunk.length;
      }

      // Remove legacy category-10 records that are no longer part of the
      // authoritative sellable souvenir result. Only clean up after a
      // successful, non-empty catalog response to avoid destructive syncs when
      // the remote API unexpectedly returns an empty payload.
      let removedSouvenirCount = 0;
      if (synchronizedSouvenirIds) {
        const existingSouvenirs = await db
          .collection(POS_COLLECTIONS.products)
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
