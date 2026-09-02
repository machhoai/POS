import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateReceiptLine,
  calculateReceiptTotals,
} from "../src/features/receipt/helpers/receiptCalculations.ts";

test("repairs a legacy taxed line whose stored tax amount is zero", () => {
  const line = calculateReceiptLine({
    goodsId: "ticket-01",
    goodsName: "Ticket",
    price: 110_000,
    quantity: 1,
    unitPriceBeforeTax: 110_000,
    taxRate: 10,
    taxAmount: 0,
  }, 0);

  assert.deepEqual(line, {
    unitPriceBeforeTax: 100_000,
    lineSubtotal: 100_000,
    lineTotalAfterTax: 110_000,
    taxRate: 10,
    taxAmount: 10_000,
  });
});

test("uses the before-tax product snapshot for receipt prices and totals", () => {
  const order = {
    totalAmount: 328_900,
    voucherDiscount: 0,
    items: [
      {
        goodsId: "ticket-01",
        goodsName: "Ticket",
        price: 220_000,
        quantity: 1,
        unitPriceBeforeTax: 200_000,
        taxRate: 10,
        taxAmount: 20_000,
      },
      {
        goodsId: "gift-01",
        goodsName: "Gift",
        price: 54_450,
        quantity: 2,
        unitPriceBeforeTax: 49_500,
        taxRate: 10,
        taxAmount: 9_900,
      },
    ],
  };

  const giftLine = calculateReceiptLine(order.items[1], 0);
  assert.equal(giftLine.unitPriceBeforeTax, 49_500);
  assert.equal(giftLine.lineSubtotal, 99_000);
  assert.equal(giftLine.lineTotalAfterTax, 108_900);

  assert.deepEqual(calculateReceiptTotals(order, 0), {
    subtotal: 299_000,
    taxTotal: 29_900,
    discount: 0,
    grandTotal: 328_900,
  });
});

test("keeps a tax-free receipt free of tax amounts", () => {
  const line = calculateReceiptLine({
    goodsId: "free-tax",
    goodsName: "Tax-free product",
    price: 100_000,
    quantity: 2,
    unitPriceBeforeTax: 100_000,
    taxRate: 0,
    taxAmount: 0,
  }, 0);

  assert.equal(line.lineSubtotal, 200_000);
  assert.equal(line.taxRate, 0);
  assert.equal(line.taxAmount, 0);
});
