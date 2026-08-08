import type { OrderItem, PosOrder } from "@/lib/types/order";

export interface ReceiptLineCalculation {
  lineTotal: number;
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
  const lineTotal = roundCurrency(item.price * item.quantity);

  if (Number.isFinite(item.taxAmount) && Number(item.taxAmount) >= 0) {
    return {
      lineTotal,
      taxRate: Number.isFinite(item.taxRate) ? Number(item.taxRate) : fallbackTaxRate,
      taxAmount: roundCurrency(Number(item.taxAmount)),
    };
  }

  if (
    Number.isFinite(item.unitPriceBeforeTax) &&
    Number(item.unitPriceBeforeTax) >= 0
  ) {
    const taxAmount =
      (item.price - Number(item.unitPriceBeforeTax)) * item.quantity;
    return {
      lineTotal,
      taxRate: Number.isFinite(item.taxRate) ? Number(item.taxRate) : fallbackTaxRate,
      taxAmount: roundCurrency(taxAmount),
    };
  }

  const safeRate = Math.max(0, Number(fallbackTaxRate) || 0);
  const taxAmount = safeRate > 0
    ? lineTotal - lineTotal / (1 + safeRate / 100)
    : 0;

  return {
    lineTotal,
    taxRate: safeRate,
    taxAmount: roundCurrency(taxAmount),
  };
}

export function calculateReceiptTotals(
  order: PosOrder,
  fallbackTaxRate: number,
): { subtotal: number; taxTotal: number; discount: number; grandTotal: number } {
  const taxTotal = order.items.reduce(
    (total, item) => total + calculateReceiptLine(item, fallbackTaxRate).taxAmount,
    0,
  );
  const discount = Math.max(0, order.voucherDiscount || 0);

  return {
    subtotal: order.totalAmount,
    taxTotal,
    discount,
    grandTotal: Math.max(0, order.totalAmount - discount),
  };
}

