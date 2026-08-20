/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isConfirmedRemoteDeletion,
  isProductAvailable,
  resolveProductAvailability,
} = require("../lib/services/productAvailability");

test("hides a product when its HK classification is disabled", () => {
  const availability = resolveProductAvailability({
    isEnabled: true,
    isOpenSales: true,
    isCategoryEnabled: false,
    isSellable: false,
  });

  assert.deepEqual(availability, {
    isEnabled: true,
    isOpenSales: false,
    isCategoryEnabled: false,
    syncStatus: "disabled",
    disabledReason: "category_disabled",
  });
  assert.equal(isProductAvailable(availability), false);
});

test("retains but hides a product that no longer appears in the sellable list", () => {
  const availability = resolveProductAvailability({
    isEnabled: true,
    isOpenSales: true,
    isCategoryEnabled: true,
    isSellable: false,
  });

  assert.equal(availability.syncStatus, "disabled");
  assert.equal(availability.disabledReason, "not_sellable");
  assert.equal(isProductAvailable(availability), false);
});

test("keeps legacy and fully active product records visible", () => {
  assert.equal(isProductAvailable({}), true);
  assert.equal(
    isProductAvailable(resolveProductAvailability()),
    true,
  );
});

test("deletes only with explicit HK deletion evidence", () => {
  assert.equal(
    isConfirmedRemoteDeletion({ category: 1, detailResponseCode: 404 }),
    true,
  );
  assert.equal(
    isConfirmedRemoteDeletion({
      category: 4,
      managementCatalogIsAuthoritative: true,
      managementCatalogContainsProduct: false,
    }),
    true,
  );
  assert.equal(
    isConfirmedRemoteDeletion({
      category: 1,
      managementCatalogIsAuthoritative: true,
      managementCatalogContainsProduct: false,
    }),
    true,
  );
  assert.equal(
    isConfirmedRemoteDeletion({ category: 1, detailResponseCode: 500 }),
    false,
  );
  assert.equal(
    isConfirmedRemoteDeletion({
      category: 1,
      detailResponseCode: 404,
      detailResponseMessage: "API action was not found",
    }),
    false,
  );
  assert.equal(
    isConfirmedRemoteDeletion({
      category: 1,
      managementCatalogIsAuthoritative: false,
      managementCatalogContainsProduct: false,
    }),
    false,
  );
});
