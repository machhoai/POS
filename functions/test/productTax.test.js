/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveOrderItemTaxPricing,
} = require("../lib/services/productTax");

test("extracts percentage tax when the API selling price already includes tax", () => {
  assert.deepEqual(resolveOrderItemTaxPricing({
    basePrice: 144000,
    sellingPrice: 144000,
    taxRate: 10,
    taxRateType: 1,
  }), {
    unitPriceBeforeTax: 130909,
    unitTaxAmount: 13091,
    taxRate: 10,
  });
});

test("preserves an explicit before-tax API price", () => {
  assert.deepEqual(resolveOrderItemTaxPricing({
    basePrice: 100000,
    sellingPrice: 110000,
    taxRate: 10,
    taxRateType: 1,
  }), {
    unitPriceBeforeTax: 100000,
    unitTaxAmount: 10000,
    taxRate: 10,
  });
});

test("keeps a tax-free selling price unchanged", () => {
  assert.deepEqual(resolveOrderItemTaxPricing({
    basePrice: 144000,
    sellingPrice: 144000,
    taxRate: 0,
    taxRateType: 1,
  }), {
    unitPriceBeforeTax: 144000,
    unitTaxAmount: 0,
    taxRate: 0,
  });
});
