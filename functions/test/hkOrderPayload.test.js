/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRemoteOrderCreateBody,
  buildRemoteOrderPayBody,
} = require("../lib/services/hkApiService");

test("order_create sends only member and goods fields to the HK system", () => {
  const body = buildRemoteOrderCreateBody({
    uid: "member-001",
    goodsItems: [{ goodsId: "goods-001", quantity: "2" }],
  });

  assert.deepEqual(body, {
    Uid: "member-001",
    GoodsItems: [{ GoodsId: "goods-001", Quantity: "2" }],
  });
  assert.equal("paymentMethod" in body, false);
  assert.equal("PaymentMethod" in body, false);
  assert.equal("PayType" in body, false);
});

test("order_pay relies on the HK default payment method", () => {
  const body = buildRemoteOrderPayBody("HK-ORDER-001");

  assert.deepEqual(body, {
    OrderNumber: "HK-ORDER-001",
    PayAmount: null,
  });
  assert.equal("paymentMethod" in body, false);
  assert.equal("PaymentMethod" in body, false);
  assert.equal("PayType" in body, false);
});
