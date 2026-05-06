// =============================================================================
// Firebase Cloud Functions — POS Sync Worker
// =============================================================================
// This is the main entry point for all Cloud Functions in the POS system.
//
// Functions:
//   1. `onOrderLocalPaid` — Firestore trigger for order sync to HK API
//   2. `syncProducts` — onCall function to sync product catalog from HK API
// =============================================================================

import {
  onDocumentUpdated,
  type Change,
  type FirestoreEvent,
} from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { db } from "./config/firebase";
import { createRemoteOrder, confirmRemotePayment } from "./services/hkApiService";
import type { PosOrder } from "./types/order";
import type { PosProduct } from "./types/product";

// =============================================================================
// syncProducts — onCall Cloud Function
// =============================================================================
// Called from the POS frontend to refresh the product catalog.
// In production, this will call the HK API to fetch the latest product list.
// For now, uses mock data when the HK API doesn't have a product endpoint.
// =============================================================================

export const syncProducts = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn phải đăng nhập để đồng bộ sản phẩm."
      );
    }

    const { storeId } = request.data as { storeId: string };

    if (!storeId) {
      throw new HttpsError(
        "invalid-argument",
        "Thiếu thông tin cửa hàng (storeId)."
      );
    }

    functions.logger.info(
      `[syncProducts] Syncing products for store ${storeId} by user ${request.auth.uid}`
    );

    try {
      // TODO: Replace with actual HK API call when goods_list endpoint is available
      // For now, generate mock products for development
      const mockProducts: PosProduct[] = [
        {
          goodsId: "DUCK-001",
          goodsName: "B.Duck Cổ Điển",
          price: 250000,
          imageUrl: "",
          categoryId: "CAT-TOY",
          categoryName: "Đồ chơi",
          isActive: true,
          stock: 50,
          barcode: "8801234567001",
          sortOrder: 1,
          storeId,
          lastSyncAt: new Date().toISOString(),
        },
        {
          goodsId: "DUCK-002",
          goodsName: "B.Duck Mini Keychain",
          price: 89000,
          imageUrl: "",
          categoryId: "CAT-ACC",
          categoryName: "Phụ kiện",
          isActive: true,
          stock: 100,
          barcode: "8801234567002",
          sortOrder: 2,
          storeId,
          lastSyncAt: new Date().toISOString(),
        },
        {
          goodsId: "DUCK-003",
          goodsName: "B.Duck Balo Trẻ Em",
          price: 450000,
          imageUrl: "",
          categoryId: "CAT-BAG",
          categoryName: "Túi xách",
          isActive: true,
          stock: 30,
          barcode: "8801234567003",
          sortOrder: 3,
          storeId,
          lastSyncAt: new Date().toISOString(),
        },
        {
          goodsId: "DUCK-004",
          goodsName: "B.Duck Nón Lưỡi Trai",
          price: 180000,
          imageUrl: "",
          categoryId: "CAT-ACC",
          categoryName: "Phụ kiện",
          isActive: true,
          stock: 45,
          barcode: "8801234567004",
          sortOrder: 4,
          storeId,
          lastSyncAt: new Date().toISOString(),
        },
        {
          goodsId: "DUCK-005",
          goodsName: "B.Duck Bình Nước 500ml",
          price: 195000,
          imageUrl: "",
          categoryId: "CAT-HOME",
          categoryName: "Gia dụng",
          isActive: true,
          stock: 60,
          barcode: "8801234567005",
          sortOrder: 5,
          storeId,
          lastSyncAt: new Date().toISOString(),
        },
        {
          goodsId: "DUCK-006",
          goodsName: "B.Duck Gấu Bông Lớn",
          price: 350000,
          imageUrl: "",
          categoryId: "CAT-TOY",
          categoryName: "Đồ chơi",
          isActive: true,
          stock: 25,
          barcode: "8801234567006",
          sortOrder: 6,
          storeId,
          lastSyncAt: new Date().toISOString(),
        },
        {
          goodsId: "DUCK-007",
          goodsName: "B.Duck Áo Thun Trẻ Em",
          price: 220000,
          imageUrl: "",
          categoryId: "CAT-CLOTH",
          categoryName: "Quần áo",
          isActive: true,
          stock: 40,
          barcode: "8801234567007",
          sortOrder: 7,
          storeId,
          lastSyncAt: new Date().toISOString(),
        },
        {
          goodsId: "DUCK-008",
          goodsName: "B.Duck Bút Chì Màu Set",
          price: 125000,
          imageUrl: "",
          categoryId: "CAT-SCHOOL",
          categoryName: "Văn phòng phẩm",
          isActive: true,
          stock: 80,
          barcode: "8801234567008",
          sortOrder: 8,
          storeId,
          lastSyncAt: new Date().toISOString(),
        },
      ];

      // Write products to Firestore (batch write for efficiency)
      const batch = db.batch();

      for (const product of mockProducts) {
        const docRef = db
          .collection("pos_products")
          .doc(`${storeId}_${product.goodsId}`);
        batch.set(docRef, product, { merge: true });
      }

      // Write categories (deduplicated from products)
      const categoryMap = new Map<string, { id: string; name: string; sortOrder: number }>();
      for (const product of mockProducts) {
        if (product.categoryId && product.categoryName) {
          if (!categoryMap.has(product.categoryId)) {
            categoryMap.set(product.categoryId, {
              id: product.categoryId,
              name: product.categoryName,
              sortOrder: categoryMap.size + 1,
            });
          }
        }
      }

      for (const [categoryId, category] of categoryMap) {
        const catRef = db
          .collection("pos_categories")
          .doc(`${storeId}_${categoryId}`);
        batch.set(
          catRef,
          { ...category, storeId },
          { merge: true }
        );
      }

      await batch.commit();

      functions.logger.info(
        `[syncProducts] ✅ Synced ${mockProducts.length} products and ${categoryMap.size} categories for store ${storeId}`
      );

      return {
        success: true,
        productCount: mockProducts.length,
        categoryCount: categoryMap.size,
        syncedAt: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      functions.logger.error(
        `[syncProducts] ❌ Failed to sync products: ${errorMessage}`
      );
      throw new HttpsError(
        "internal",
        "Đồng bộ sản phẩm thất bại. Vui lòng thử lại."
      );
    }
  }
);


/**
 * Firestore Trigger: Fires when any document in `pos_orders` is updated.
 *
 * We check if the status has changed to "LOCAL_PAID" and then kick off
 * the background sync process with the HK remote API.
 */
export const onOrderLocalPaid = onDocumentUpdated(
  "pos_orders/{orderId}",
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
