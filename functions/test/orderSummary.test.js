/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPosOrderSummary } = require("../lib/order/orderSummary");

test("builds a compact searchable projection from a legacy order", () => {
  const result = buildPosOrderSummary({
    localOrderId: "ORD-1",
    hkOrderNumber: null,
    shopId: 1,
    warehouseId: "warehouse-1",
    createdBy: "user-1",
    operatorId: "EMP-1",
    operatorFirebaseUid: "user-1",
    operatorName: "Thu ngân",
    status: "LOCAL_PAID",
    paymentMethod: "CASH",
    paymentMethodId: "cash",
    paymentMethodName: "Tiền mặt",
    totalAmount: 180000,
    member: {
      uid: "member-1",
      memberCode: "M1",
      fullName: "Khách hàng",
      phone: "+84 908 350 370",
      levelName: "",
    },
    items: [
      { goodsId: "g1", goodsName: "Vé lượt", price: 180000, quantity: 1 },
    ],
    sync: { retryCount: 0, lastError: null, syncedAt: null },
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
  });
  assert.equal(result.paymentStatus, "PAID");
  assert.equal(result.syncStatus, "PENDING");
  assert.equal(result.normalizedPhone, "0908350370");
  assert.deepEqual(result.productNames, ["Vé lượt"]);
});

