export interface ExistingProductIdentity {
  id: string;
  isDeleted?: boolean;
}

export function findNewProductIds(
  existingProducts: readonly ExistingProductIdentity[],
  synchronizedProductIds: readonly string[],
): string[] {
  const existingIds = new Set(
    existingProducts
      .filter((product) => product.isDeleted !== true)
      .map((product) => product.id),
  );
  return [...new Set(synchronizedProductIds)]
    .filter((productId) => !existingIds.has(productId))
    .sort();
}

export function mergeHiddenProductIds(
  currentIds: readonly string[],
  newProductIds: readonly string[],
): string[] {
  return [...new Set([...currentIds, ...newProductIds])].sort();
}
