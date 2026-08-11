import * as logger from "firebase-functions/logger";
import { db } from "../config/firebase";
import { POS_COLLECTIONS } from "../config/collections";
import {
  fetchGoodsByCategory,
  fetchMemberPackageDetail,
  fetchProductVisualCatalog,
  fetchSetmealTypes,
  type HKGoodsItem,
  type HKProductVisualItem,
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
const POINT_PACKAGE_CATEGORY_IDS = new Set([1, 2, 6]);

interface ProductVisualMetadata {
  foreColor?: string;
  backColor?: string;
  ticketsPerUnit?: number;
  principalPoints?: number;
  bonusPoints?: number;
}

function toNonNegativeNumber(...values: unknown[]): number {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

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
  data: unknown,
  extraKeys: string[] = [],
): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data !== "object") return [];

  const record = data as Record<string, unknown>;

  for (const key of ["list", "data", "items", ...extraKeys]) {
    if (Array.isArray(record[key])) return record[key] as T[];
  }

  return [];
}

function mapProductVisualMetadata(items: HKProductVisualItem[]) {
  const metadataByGoodsId = new Map<
    string,
    ProductVisualMetadata
  >();

  for (const item of items) {
    const goodsId = (
      item.SetMealId ||
      item.setMealId ||
      item.GoodsId ||
      item.goodsId ||
      ""
    ).trim();
    if (!goodsId) continue;

    const foreColor = (item.ForeColor || item.foreColor || "").trim();
    const backColor = (item.BackColor || item.backColor || "").trim();
    const rawTicketsPerUnit = Number(item.Amount ?? item.amount);
    const ticketsPerUnit = Number.isInteger(rawTicketsPerUnit) && rawTicketsPerUnit >= 0
      ? rawTicketsPerUnit
      : undefined;
    if (!foreColor && !backColor && ticketsPerUnit === undefined) continue;

    metadataByGoodsId.set(goodsId, {
      ...(foreColor ? { foreColor } : {}),
      ...(backColor ? { backColor } : {}),
      ...(ticketsPerUnit !== undefined ? { ticketsPerUnit } : {}),
    });
  }

  return metadataByGoodsId;
}

async function loadProductDetailMetadata(
  items: HKGoodsItem[],
  metadataByGoodsId: Map<string, ProductVisualMetadata>,
): Promise<void> {
  const goodsIds = Array.from(new Set(items.flatMap((item) => {
    const goodsId = (item.GoodsId || item.goodsId || "").trim();
    return goodsId ? [goodsId] : [];
  })));
  const results = await Promise.allSettled(goodsIds.map(async (goodsId) => ({
    goodsId,
    response: await fetchMemberPackageDetail(goodsId),
  })));
  let loadedCount = 0;
  let failedCount = 0;

  for (const result of results) {
    if (result.status === "rejected" || !result.value.response.success) {
      failedCount += 1;
      continue;
    }

    const detail = result.value.response.data;
    const foreColor = detail?.foreColor?.trim() || "";
    const backColor = detail?.backColor?.trim() || "";
    const principalPoints = toNonNegativeNumber(detail?.amount, detail?.Amount);
    const bonusPoints = (detail?.giveConfigs ?? []).reduce((total, config) => {
      const giveAmount = Number(config.giveAmount);
      return Number.isFinite(giveAmount) && giveAmount > 0
        ? total + giveAmount
        : total;
    }, 0);
    metadataByGoodsId.set(result.value.goodsId, {
      ...metadataByGoodsId.get(result.value.goodsId),
      ...(foreColor ? { foreColor } : {}),
      ...(backColor ? { backColor } : {}),
      principalPoints,
      bonusPoints,
    });
    loadedCount += 1;
  }

  logger.info("[productSync] Product detail metadata loaded", {
    requestedCount: goodsIds.length,
    loadedCount,
    failedCount,
  });
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
      ...(data.foreColor ? { foreColor: String(data.foreColor) } : {}),
      ...(data.backColor ? { backColor: String(data.backColor) } : {}),
      ...(Number.isFinite(Number(data.principalPoints)) && Number(data.principalPoints) >= 0
        ? { principalPoints: Number(data.principalPoints) }
        : {}),
      ...(Number.isFinite(Number(data.bonusPoints)) && Number(data.bonusPoints) >= 0
        ? { bonusPoints: Number(data.bonusPoints) }
        : {}),
      ...(Number.isInteger(Number(data.ticketsPerUnit)) && Number(data.ticketsPerUnit) >= 0
        ? { ticketsPerUnit: Number(data.ticketsPerUnit) }
        : {}),
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

  const visualResponse = await fetchProductVisualCatalog();
  const visualColorsByGoodsId = visualResponse.success
    ? mapProductVisualMetadata(extractList<HKProductVisualItem>(visualResponse.data))
    : new Map<string, ProductVisualMetadata>();

  if (!visualResponse.success) {
    logger.warn("[productSync] Product visual catalog request failed", {
      code: visualResponse.code,
      message: visualResponse.msg,
    });
  } else {
    logger.info("[productSync] Product visual metadata loaded", {
      metadataCount: visualColorsByGoodsId.size,
    });
  }

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
    if (POINT_PACKAGE_CATEGORY_IDS.has(categoryId)) {
      await loadProductDetailMetadata(
        ungroupedItems,
        visualColorsByGoodsId,
      );
    }
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
        visualColorsByGoodsId,
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
      visualColorsByGoodsId,
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
