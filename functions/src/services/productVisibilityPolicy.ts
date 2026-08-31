import { buildProductGroupKey } from "./productGrouping";

const stringSet = (value: unknown): Set<string> =>
  new Set(
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [],
  );

export function isProductAvailableForWarehouse(
  productId: string,
  product: Record<string, unknown>,
  settings: Record<string, unknown> | undefined,
): boolean {
  if (
    product.isEnabled === false ||
    product.isOpenSales === false ||
    product.isCategoryEnabled === false ||
    product.syncStatus === "disabled"
  ) return false;
  const groupKey = typeof product.groupKey === "string" && product.groupKey
    ? product.groupKey
    : buildProductGroupKey(product);
  return !stringSet(settings?.disabled_product_ids).has(productId)
    && !stringSet(settings?.disabled_group_keys).has(groupKey);
}

