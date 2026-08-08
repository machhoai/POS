/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateMemberPackageCatalogInput,
  validateMemberPackageSaleInput,
  validateMemberPackageOrderId,
} = require("../lib/member/packagePolicy");

test("validates package catalog scope", () => {
  assert.deepEqual(validateMemberPackageCatalogInput({
    shopId: 10,
    warehouseId: "warehouse-1",
    uid: "member-uid",
  }), {
    shopId: 10,
    warehouseId: "warehouse-1",
    uid: "member-uid",
  });
});

test("validates a member package sale", () => {
  const input = validateMemberPackageSaleInput({
    shopId: 10,
    warehouseId: "warehouse-1",
    uid: "member-uid",
    localOrderId: "ORD-1770000000000-ABC123",
    goodsId: "silver-package",
  });
  assert.equal(input.goodsId, "silver-package");
});

test("rejects malformed local package order IDs", () => {
  assert.throws(
    () => validateMemberPackageOrderId({ localOrderId: "bad-order" }),
    /Mã đơn hàng không hợp lệ/,
  );
});
