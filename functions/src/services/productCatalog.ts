import type {
  HKGoodsItem,
  HKSouvenirStockItem,
} from "./hkApiService";
import type { SyncProduct } from "../types/product";
import { SOUVENIR_CATEGORY_ID } from "../types/product";

function toFiniteNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

/**
 * Convert package/ticket records queried through a concrete `TypeId` into
 * products carrying the classification name used by the POS group filter.
 */
export function mapGroupedGoods(
  items: HKGoodsItem[],
  category: number,
  typeName: string,
  lastSyncAt: string
): SyncProduct[] {
  const normalizedTypeName = typeName.trim() || "Khác";

  return items.flatMap((item) => {
    const goodsId = (item.GoodsId || item.goodsId || "").trim();
    if (!goodsId) return [];

    const subCategory = String(
      item.SubCategory ??
      item.subCategory ??
      item.CategoryGroupName ??
      item.categoryGroupName ??
      ""
    );

    return [{
      goodsId,
      goodsName:
        (item.GoodsName || item.goodsName || "").trim() || "Không rõ tên",
      description: item.Remark || item.remark || "",
      price: toFiniteNumber(item.Price ?? item.price) ?? 0,
      category,
      subCategory,
      typeName: normalizedTypeName,
      lastSyncAt,
    }];
  });
}

/**
 * Convert HK physical-stock records into POS souvenir products.
 *
 * Only records with a positive `price` are sellable. The similarly named
 * `giftPrice` field is the purchase unit price and is intentionally ignored.
 */
export function mapSellableSouvenirs(
  items: HKSouvenirStockItem[],
  lastSyncAt: string
): SyncProduct[] {
  const productsByGiftNo = new Map<string, SyncProduct>();

  for (const item of items) {
    const giftNo = (item.GiftNo || item.giftNo || "").trim();
    const salePrice = toFiniteNumber(item.Price ?? item.price);

    if (!giftNo || salePrice === null || salePrice <= 0) {
      continue;
    }

    const amount = Math.max(
      0,
      toFiniteNumber(item.Amount ?? item.amount) ?? 0
    );
    const typeName = (item.TypeName || item.typeName || "").trim();
    const goodsName = (item.GiftName || item.giftName || "").trim() || giftNo;
    const existingProduct = productsByGiftNo.get(giftNo);

    if (existingProduct) {
      existingProduct.amount = (existingProduct.amount ?? 0) + amount;
      continue;
    }

    productsByGiftNo.set(giftNo, {
      goodsId: giftNo,
      goodsName,
      price: salePrice,
      category: SOUVENIR_CATEGORY_ID,
      subCategory: typeName,
      typeName,
      amount,
      giftNo,
      lastSyncAt,
    });
  }

  return Array.from(productsByGiftNo.values());
}
