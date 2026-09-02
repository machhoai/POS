import type {
  HKGoodsItem,
} from "./hkApiService";
import type { JoyworldGiftCatalogItem } from "./joyworldCatalogService";
import type { SyncProduct } from "../types/product";
import { SOUVENIR_CATEGORY_ID } from "../types/product";
import { resolveProductAvailability } from "./productAvailability";
import { buildProductGroupKey } from "./productGrouping";

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

function resolveProductTax(input: {
  goodsId: string;
  price: number;
  afterTaxPrice?: number | null;
  taxRate?: number | null;
  taxRateType?: number | null;
}): { afterTaxPrice: number; taxRate: number; taxRateType: number } {
  const explicitAfterTaxPrice = input.afterTaxPrice ?? null;
  const resolvedTaxRateType = input.taxRateType ?? 1;
  const resolvedTaxRate = input.taxRate ?? (
    explicitAfterTaxPrice !== null && input.price > 0
      ? resolvedTaxRateType === 2
        ? explicitAfterTaxPrice - input.price
        : ((explicitAfterTaxPrice - input.price) / input.price) * 100
      : null
  );

  if (
    resolvedTaxRate === null ||
    !Number.isFinite(resolvedTaxRate) ||
    resolvedTaxRate < 0 ||
    !Number.isFinite(resolvedTaxRateType) ||
    ![1, 2].includes(resolvedTaxRateType)
  ) {
    throw new Error(
      `Sản phẩm ${input.goodsId} thiếu cấu hình thuế hợp lệ từ OpenAPI.`,
    );
  }

  const calculatedAfterTaxPrice = resolvedTaxRateType === 2
    ? input.price + resolvedTaxRate
    : input.price * (1 + resolvedTaxRate / 100);
  const afterTaxPrice = explicitAfterTaxPrice ??
    Number(calculatedAfterTaxPrice.toFixed(2));

  if (!Number.isFinite(afterTaxPrice) || afterTaxPrice < input.price) {
    throw new Error(
      `Sản phẩm ${input.goodsId} có giá sau thuế không hợp lệ từ OpenAPI.`,
    );
  }

  return {
    afterTaxPrice,
    taxRate: Number(resolvedTaxRate.toFixed(4)),
    taxRateType: resolvedTaxRateType,
  };
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
    {
      foreColor?: string;
      backColor?: string;
      ticketsPerUnit?: number;
      principalPoints?: number;
      bonusPoints?: number;
      isEnabled?: boolean;
      isOpenSales?: boolean;
      typeId?: string;
      taxRate?: number;
      taxRateType?: number;
      afterTaxPrice?: number;
    }
  > = new Map(),
  typeId = "",
  isCategoryEnabled = true,
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
    const tax = resolveProductTax({
      goodsId,
      price,
      afterTaxPrice: visualColors?.afterTaxPrice ??
        toFiniteNumber(item.AfterTaxPrice ?? item.afterTaxPrice),
      taxRate: visualColors?.taxRate ??
        toFiniteNumber(
          item.TaxRate ??
          item.taxRate ??
          item.SetmealTypeTaxRate ??
          item.setmealTypeTaxRate,
        ),
      taxRateType: visualColors?.taxRateType ??
        toFiniteNumber(item.TaxRateType ?? item.taxRateType),
    });
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
    const availability = resolveProductAvailability({
      isEnabled: visualColors?.isEnabled,
      isOpenSales: visualColors?.isOpenSales,
      isCategoryEnabled,
      isSellable: true,
    });

    const productTypeId = visualColors?.typeId || typeId;
    return [{
      goodsId,
      goodsName:
        (item.GoodsName || item.goodsName || "").trim() || "Không rõ tên",
      description: item.Remark || item.remark || "",
      price,
      afterTaxPrice: tax.afterTaxPrice,
      taxRate: tax.taxRate,
      taxRateType: tax.taxRateType,
      category,
      subCategory,
      typeId: productTypeId,
      typeName: normalizedTypeName,
      groupKey: buildProductGroupKey({ category, typeId: productTypeId, typeName: normalizedTypeName }),
      ...(foreColor ? { foreColor } : {}),
      ...(backColor ? { backColor } : {}),
      ...(visualColors?.principalPoints !== undefined
        ? { principalPoints: visualColors.principalPoints }
        : {}),
      ...(visualColors?.bonusPoints !== undefined
        ? { bonusPoints: visualColors.bonusPoints }
        : {}),
      ...(ticketsPerUnit !== undefined ? { ticketsPerUnit } : {}),
      ...availability,
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

    const tax = resolveProductTax({
      goodsId,
      price,
      afterTaxPrice,
      taxRate: toFiniteNumber(item.taxRate ?? item.setmealTypeTaxRate),
      taxRateType: toFiniteNumber(item.taxRateType),
    });

    productsById.set(goodsId, {
      goodsId,
      goodsName,
      price,
      afterTaxPrice: tax.afterTaxPrice,
      taxRate: tax.taxRate,
      taxRateType: tax.taxRateType,
      category: SOUVENIR_CATEGORY_ID,
      subCategory: typeName,
      typeName,
      groupKey: buildProductGroupKey({
        category: SOUVENIR_CATEGORY_ID,
        typeName,
      }),
      amount,
      giftNo,
      ...(foreColor ? { foreColor } : {}),
      ...(backColor ? { backColor } : {}),
      ...resolveProductAvailability(),
      lastSyncAt,
    });
  }

  return Array.from(productsById.values());
}
