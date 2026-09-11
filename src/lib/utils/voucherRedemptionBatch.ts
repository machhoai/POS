import type { PosVoucherResolution } from "@/lib/types/voucher";

export const VOUCHER_BATCH_IDLE_MS = 10_000;
export const VOUCHER_DUPLICATE_WINDOW_MS = 3_000;

export function isDuplicateVoucherScan(
  code: string,
  activeCodes: ReadonlySet<string>,
  recentCodes: ReadonlyMap<string, number>,
  now = Date.now(),
): boolean {
  if (activeCodes.has(code)) return true;
  const handledAt = recentCodes.get(code);
  return handledAt !== undefined && now - handledAt < VOUCHER_DUPLICATE_WINDOW_MS;
}

export function aggregateVoucherProducts(
  vouchers: readonly PosVoucherResolution[],
): Array<{ goodsId: string; quantity: number }> {
  const quantities = new Map<string, number>();
  for (const voucher of vouchers) {
    quantities.set(
      voucher.product.goodsId,
      (quantities.get(voucher.product.goodsId) ?? 0) + voucher.product.quantity,
    );
  }
  return Array.from(quantities, ([goodsId, quantity]) => ({ goodsId, quantity }));
}
