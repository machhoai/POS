import type { HKSouvenirStockItem } from "./hkApiService";
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
