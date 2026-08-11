import type {
  HKGoodsItem,
} from "./hkApiService";
import type { JoyworldGiftCatalogItem } from "./joyworldCatalogService";
import type { SyncProduct } from "../types/product";
import { SOUVENIR_CATEGORY_ID } from "../types/product";

function toFiniteNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toOptionalString(...values: Array<string | undefined>): string | undefined {
  const value = values.find((candidate) => candidate?.trim());
  return value?.trim();
}

/**
 * Convert package/ticket records queried through a concrete `TypeId` into
 * products carrying the classification name used by the POS group filter.
 */
export function mapGroupedGoods(
  items: HKGoodsItem[],
  category: number,
  typeName: string,
  lastSyncAt: string,
  visualColorsByGoodsId: ReadonlyMap<
    string,
    { foreColor?: string; backColor?: string; ticketsPerUnit?: number }
  > = new Map(),
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

    const price = toFiniteNumber(item.Price ?? item.price) ?? 0;
    const visualColors = visualColorsByGoodsId.get(goodsId);
    const foreColor = toOptionalString(
      item.ForeColor,
      item.foreColor,
      visualColors?.foreColor,
    );
    const backColor = toOptionalString(
      item.BackColor,
      item.backColor,
      visualColors?.backColor,
    );
    const ticketsPerUnit = category === 4
      ? visualColors?.ticketsPerUnit
      : undefined;

    return [{
      goodsId,
      goodsName:
        (item.GoodsName || item.goodsName || "").trim() || "Không rõ tên",
      description: item.Remark || item.remark || "",
      price,
      afterTaxPrice:
        toFiniteNumber(item.AfterTaxPrice ?? item.afterTaxPrice) ?? price,
      category,
      subCategory,
      typeName: normalizedTypeName,
      ...(foreColor ? { foreColor } : {}),
      ...(backColor ? { backColor } : {}),
      ...(ticketsPerUnit !== undefined ? { ticketsPerUnit } : {}),
      lastSyncAt,
    }];
  });
}

/**
 * Convert JoyWorld master-catalog records into POS souvenir products.
 *
 * `afterTaxPrice` is the authoritative consumer price. The OpenAPI
 * `gift_realtime_stock.price` field is intentionally not used because it is
 * the before-tax value and that endpoint does not expose `afterTaxPrice`.
 */
export function mapSellableSouvenirs(
  items: JoyworldGiftCatalogItem[],
  lastSyncAt: string
): SyncProduct[] {
  const productsById = new Map<string, SyncProduct>();

  for (const item of items) {
    const goodsId = (item.goodsId || item.id || "").trim();
    const giftNo = (item.giftNo || "").trim();
    const price = toFiniteNumber(item.price) ?? 0;
    const afterTaxPrice = toFiniteNumber(item.afterTaxPrice);

    if (
      !goodsId ||
      !giftNo ||
      afterTaxPrice === null ||
      afterTaxPrice <= 0 ||
      item.isEnabled === false ||
      item.isOpenSales === false
    ) {
      continue;
    }

    const amount = Math.max(
      0,
      toFiniteNumber(item.stockAmount) ?? 0
    );
    const typeName = (item.typeName || "").trim();
    const goodsName = (item.giftName || item.goodsName || "").trim() || giftNo;
    const foreColor = toOptionalString(item.foreColor ?? undefined);
    const backColor = toOptionalString(item.backColor ?? undefined);
    const existingProduct = productsById.get(goodsId);

    if (existingProduct) {
      existingProduct.amount = (existingProduct.amount ?? 0) + amount;
      continue;
    }

    productsById.set(goodsId, {
      goodsId,
      goodsName,
      price,
      afterTaxPrice,
      category: SOUVENIR_CATEGORY_ID,
      subCategory: typeName,
      typeName,
      amount,
      giftNo,
      ...(foreColor ? { foreColor } : {}),
      ...(backColor ? { backColor } : {}),
      lastSyncAt,
    });
  }

  return Array.from(productsById.values());
}
