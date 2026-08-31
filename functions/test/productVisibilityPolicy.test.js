/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isProductAvailableForWarehouse,
} = require("../lib/services/productVisibilityPolicy");

const product = {
  category: 10,
  typeName: "Souvenirs",
  groupKey: "category:10:name:souvenirs",
};

test("keeps legacy products visible when no store override exists", () => {
  assert.equal(isProductAvailableForWarehouse("gift-1", product), true);
});

test("hides one product without hiding siblings", () => {
  const settings = { disabled_product_ids: ["gift-1"] };
  assert.equal(isProductAvailableForWarehouse("gift-1", product, settings), false);
  assert.equal(isProductAvailableForWarehouse("gift-2", product, settings), true);
});

test("a disabled subgroup takes precedence over individual product state", () => {
  const settings = { disabled_group_keys: [product.groupKey], disabled_product_ids: [] };
  assert.equal(isProductAvailableForWarehouse("gift-1", product, settings), false);
});

test("upstream availability always takes precedence", () => {
  assert.equal(
    isProductAvailableForWarehouse("gift-1", { ...product, isOpenSales: false }, {}),
    false,
  );
});
