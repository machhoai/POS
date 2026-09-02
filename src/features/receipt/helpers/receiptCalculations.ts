import type { OrderItem, PosOrder } from "@/lib/types/order";

export interface ReceiptLineCalculation {
  unitPriceBeforeTax: number;
  lineSubtotal: number;
  lineTotalAfterTax: number;
  taxRate: number;
  taxAmount: number;
}

function roundCurrency(value: number): number {
  return Math.max(0, Math.round(value));
}

export function calculateReceiptLine(
  item: OrderItem,
  fallbackTaxRate: number,
): ReceiptLineCalculation {
  const quantity = Number.isFinite(item.quantity) && item.quantity > 0
    ? item.quantity
    : 0;
  const lineTotalAfterTax = roundCurrency(item.price * quantity);
  const itemTaxRate = Number(item.taxRate);
  const safeRate = Number.isFinite(itemTaxRate) && itemTaxRate >= 0
    ? itemTaxRate
    : Math.max(0, Number(fallbackTaxRate) || 0);
  const storedUnitPriceBeforeTax = Number(item.unitPriceBeforeTax);
  const hasStoredUnitPriceBeforeTax =
    Number.isFinite(storedUnitPriceBeforeTax) &&
    storedUnitPriceBeforeTax >= 0 &&
    storedUnitPriceBeforeTax <= item.price;
  const storedTaxAmount = Number(item.taxAmount);
  const hasPositiveStoredTaxAmount =
    Number.isFinite(storedTaxAmount) &&
    storedTaxAmount > 0 &&
    storedTaxAmount <= lineTotalAfterTax;

  // Some legacy orders contain taxRate > 0 together with taxAmount = 0 and a
  // before-tax price equal to the tax-inclusive price. Treat that snapshot as
  // inconsistent and reconstruct the tax base from the rate.
  const canUseStoredUnitPrice = hasStoredUnitPriceBeforeTax && (
    storedUnitPriceBeforeTax < item.price || safeRate === 0
  );
  const rawUnitPriceBeforeTax = canUseStoredUnitPrice
    ? storedUnitPriceBeforeTax
    : hasPositiveStoredTaxAmount && quantity > 0
      ? (lineTotalAfterTax - storedTaxAmount) / quantity
      : safeRate > 0
        ? item.price / (1 + safeRate / 100)
        : hasStoredUnitPriceBeforeTax
          ? storedUnitPriceBeforeTax
          : item.price;
  const unitPriceBeforeTax = roundCurrency(rawUnitPriceBeforeTax);
  const lineSubtotal = roundCurrency(rawUnitPriceBeforeTax * quantity);
  const taxAmount = roundCurrency(lineTotalAfterTax - lineSubtotal);
  const resolvedTaxRate = safeRate > 0
    ? safeRate
    : lineSubtotal > 0 && taxAmount > 0
      ? Number(((taxAmount / lineSubtotal) * 100).toFixed(4))
      : 0;

  return {
    unitPriceBeforeTax,
    lineSubtotal,
    lineTotalAfterTax,
    taxRate: resolvedTaxRate,
    taxAmount,
  };
}

export function calculateReceiptTotals(
  order: PosOrder,
  fallbackTaxRate: number,
): { subtotal: number; taxTotal: number; discount: number; grandTotal: number } {
  const lines = order.items.map((item) =>
    calculateReceiptLine(item, fallbackTaxRate));
  const subtotal = lines.reduce(
    (total, line) => total + line.lineSubtotal,
    0,
  );
  const taxTotal = lines.reduce(
    (total, line) => total + line.taxAmount,
    0,
  );
  const discount = Math.max(0, order.voucherDiscount || 0);

  return {
    subtotal,
    taxTotal,
    discount,
    grandTotal: Math.max(0, order.totalAmount - discount),
  };
}
