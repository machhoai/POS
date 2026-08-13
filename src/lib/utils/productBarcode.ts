import type { Product } from "@/lib/types/product";

function normalizeBarcode(value: string | undefined): string {
  return value?.trim().toLocaleUpperCase("en-US") ?? "";
}

/**
 * Match a scanner value against the exact product identifiers in the catalog.
 * `giftNo` is the barcode/product code currently returned by the souvenir API.
 */
export function findProductByBarcode(
  products: readonly Product[],
  scannedValue: string,
): Product | null {
  const barcode = normalizeBarcode(scannedValue);
  if (!barcode) return null;

  return products.find((product) =>
    [product.barCode, product.giftNo, product.goodsId]
      .some((value) => normalizeBarcode(value) === barcode)
  ) ?? null;
}
