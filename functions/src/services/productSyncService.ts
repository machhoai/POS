import * as logger from "firebase-functions/logger";
import { db } from "../config/firebase";
import { POS_COLLECTIONS } from "../config/collections";
import {
  fetchGoodsByCategory,
  fetchSetmealTypes,
  type HKGoodsItem,
  type HKSetmealType,
} from "./hkApiService";
import { fetchSouvenirCatalog } from "./joyworldCatalogService";
import {
  mapGroupedGoods,
  mapSellableSouvenirs,
} from "./productCatalog";
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

interface SetmealTypeOption {
  typeId: string;
  typeName: string;
}

function normalizeSetmealTypes(items: HKSetmealType[]): SetmealTypeOption[] {
  return items.flatMap((item) => {
    const typeId = (
      item.key ||
      item.Key ||
      item.typeId ||
      item.TypeId ||
      ""
    ).trim();
    const typeName = (
      item.value ||
      item.Value ||
      item.typeName ||
      item.TypeName ||
      ""
    ).trim();

    return typeId && typeName ? [{ typeId, typeName }] : [];
  });
}

export async function loadPosProductCatalog(): Promise<ProductCatalogResult> {
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
      !Number.isFinite(category) ||
      (category === SOUVENIR_CATEGORY_ID && afterTaxPrice <= 0)
    ) {
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

  const typeResponse = await fetchSetmealTypes();
  if (!typeResponse.success) {
    throw new Error(
      `setmeal_type_select failed: [${typeResponse.code}] ${typeResponse.msg}`,
    );
  }

  const setmealTypes = normalizeSetmealTypes(
    extractList<HKSetmealType>(typeResponse.data),
  );
  if (setmealTypes.length === 0) {
    throw new Error("setmeal_type_select returned no product classifications");
  }

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

    const ungroupedItems = extractList<HKGoodsItem>(
      response.data,
      ["goodsItems"],
    );
    const productsById = new Map<string, SyncProduct>();

    for (const setmealType of setmealTypes) {
      const groupedResponse = await fetchGoodsByCategory(
        categoryId,
        setmealType.typeId,
      );

      if (!groupedResponse.success) {
        throw new Error(
          `setmeal_getsellgoods failed for category ${categoryId}, ` +
          `type ${setmealType.typeId}: ` +
          `[${groupedResponse.code}] ${groupedResponse.msg}`,
        );
      }

      const groupedItems = extractList<HKGoodsItem>(
        groupedResponse.data,
        ["goodsItems"],
      );
      const groupedProducts = mapGroupedGoods(
        groupedItems,
        categoryId,
        setmealType.typeName,
        now,
      );

      for (const product of groupedProducts) {
        productsById.set(product.goodsId, product);
      }
    }

    // Keep unclassified API products visible instead of dropping them.
    for (const product of mapGroupedGoods(
      ungroupedItems,
      categoryId,
      "Khác",
      now,
    )) {
      if (!productsById.has(product.goodsId)) {
        productsById.set(product.goodsId, product);
      }
    }

    allProducts.push(...productsById.values());

    logger.info("[productSync] Category grouped", {
      categoryId,
      productCount: productsById.size,
      typeCount: setmealTypes.length,
    });
  }

  const rawSouvenirs = await fetchSouvenirCatalog();
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
