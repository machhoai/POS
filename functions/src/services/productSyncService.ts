import * as logger from "firebase-functions/logger";
import { db } from "../config/firebase";
import { POS_COLLECTIONS } from "../config/collections";
import {
  fetchGoodsByCategory,
  fetchSouvenirStock,
  type HKGoodsItem,
  type HKSouvenirStockItem,
} from "./hkApiService";
import { mapSellableSouvenirs } from "./productCatalog";
import {
  SOUVENIR_CATEGORY_ID,
  SYNC_CATEGORY_IDS,
  type SyncProduct,
} from "../types/product";

const BATCH_LIMIT = 500;

export interface ProductSyncResult {
  success: true;
  productCount: number;
  souvenirProductCount: number;
  removedSouvenirCount: number;
  syncedAt: string;
}

export interface ProductCatalogResult {
  products: SyncProduct[];
  fetchedAt: string;
}

function extractList<T>(
  data: Record<string, unknown> | null,
  extraKeys: string[] = [],
): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];

  for (const key of ["list", "data", "items", ...extraKeys]) {
    if (Array.isArray(data[key])) return data[key] as T[];
  }

  return [];
}

export async function loadPosProductCatalog(): Promise<ProductCatalogResult> {
  const snapshot = await db.collection(POS_COLLECTIONS.products).get();
  const products: SyncProduct[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as Partial<SyncProduct>;
    const price = Number(data.price);
    const category = Number(data.category);

    if (
      !data.goodsName ||
      !Number.isFinite(price) ||
      !Number.isFinite(category) ||
      (category === SOUVENIR_CATEGORY_ID && price <= 0)
    ) {
      continue;
    }

    products.push({
      goodsId: String(data.goodsId || doc.id),
      goodsName: String(data.goodsName),
      description: data.description ? String(data.description) : "",
      price,
      category,
      subCategory: data.subCategory ? String(data.subCategory) : "",
      ...(Number.isFinite(Number(data.amount))
        ? { amount: Number(data.amount) }
        : {}),
      ...(data.giftNo ? { giftNo: String(data.giftNo) } : {}),
      ...(data.typeName ? { typeName: String(data.typeName) } : {}),
      lastSyncAt: data.lastSyncAt ? String(data.lastSyncAt) : "",
    });
  }

  return {
    products,
    fetchedAt: new Date().toISOString(),
  };
}

export async function synchronizePosProducts(
  userId: string,
): Promise<ProductSyncResult> {
  logger.info("[productSync] Starting product synchronization", { userId });

  const now = new Date().toISOString();
  const allProducts: SyncProduct[] = [];

  for (const categoryId of SYNC_CATEGORY_IDS) {
    const response = await fetchGoodsByCategory(categoryId);

    if (!response.success) {
      logger.warn("[productSync] Category request failed", {
        categoryId,
        code: response.code,
        message: response.msg,
      });
      continue;
    }

    const rawItems = extractList<HKGoodsItem>(
      response.data,
      ["goodsItems"],
    );

    for (const item of rawItems) {
      const goodsId = item.GoodsId || item.goodsId;
      if (!goodsId) continue;

      allProducts.push({
        goodsId,
        goodsName: item.GoodsName || item.goodsName || "Không rõ tên",
        description: item.Remark || item.remark || "",
        price: Number(item.Price || item.price || 0),
        category: categoryId,
        subCategory:
          item.SubCategory ||
          item.subCategory ||
          item.CategoryGroupName ||
          item.categoryGroupName ||
          "",
        lastSyncAt: now,
      });
    }
  }

  const souvenirResponse = await fetchSouvenirStock();
  if (!souvenirResponse.success) {
    throw new Error(
      `gift_realtime_stock failed: [${souvenirResponse.code}] ${souvenirResponse.msg}`,
    );
  }

  const rawSouvenirs = extractList<HKSouvenirStockItem>(
    souvenirResponse.data,
  );
  const sellableSouvenirs = mapSellableSouvenirs(rawSouvenirs, now);
  allProducts.push(...sellableSouvenirs);

  for (let index = 0; index < allProducts.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = allProducts.slice(index, index + BATCH_LIMIT);

    for (const product of chunk) {
      batch.set(
        db.collection(POS_COLLECTIONS.products).doc(product.goodsId),
        product,
        { merge: true },
      );
    }

    await batch.commit();
  }

  let removedSouvenirCount = 0;
  if (rawSouvenirs.length > 0) {
    const sellableIds = new Set(
      sellableSouvenirs.map((product) => product.goodsId),
    );
    const existingSouvenirs = await db
      .collection(POS_COLLECTIONS.products)
      .where("category", "==", SOUVENIR_CATEGORY_ID)
      .get();
    const staleDocuments = existingSouvenirs.docs.filter(
      (doc) => !sellableIds.has(doc.id),
    );

    for (
      let index = 0;
      index < staleDocuments.length;
      index += BATCH_LIMIT
    ) {
      const batch = db.batch();
      const chunk = staleDocuments.slice(index, index + BATCH_LIMIT);
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      removedSouvenirCount += chunk.length;
    }
  } else {
    logger.warn(
      "[productSync] Souvenir API returned an empty list; stale cleanup skipped",
    );
  }

  logger.info("[productSync] Product synchronization completed", {
    productCount: allProducts.length,
    souvenirProductCount: sellableSouvenirs.length,
    removedSouvenirCount,
  });

  return {
    success: true,
    productCount: allProducts.length,
    souvenirProductCount: sellableSouvenirs.length,
    removedSouvenirCount,
    syncedAt: now,
  };
}
