/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateVoucherDiscount,
  normalizeVoucherCode,
} = require("../lib/services/voucherService");

const product = {
  goodsId: "TICKET-01",
  goodsName: "Vé vui chơi",
  price: 200000,
  quantity: 1,
};

test("normalizes voucher codes before lookup", () => {
  assert.equal(normalizeVoucherCode("  jp-abc123  "), "JP-ABC123");
  assert.throws(() => normalizeVoucherCode("bad code"));
});

test("applies free products before the whole-order percentage voucher", () => {
  const result = calculateVoucherDiscount(
    [
      { ...product, quantity: 2 },
      { goodsId: "GIFT-01", goodsName: "Quà", price: 50000, quantity: 1 },
    ],
    [
      {
        code: "FREE-001",
        campaignId: "campaign-free",
        campaignName: "Tặng vé",
        rewardType: "FREE_TICKET",
        rewardValue: 0,
        product,
      },
      {
        code: "PERCENT-001",
        campaignId: "campaign-percent",
        campaignName: "Giảm 20%",
        rewardType: "DISCOUNT_PERCENT",
        rewardValue: 20,
        product,
      },
    ],
  );

  assert.equal(result.subtotalAmount, 450000);
  assert.equal(result.discountAmount, 250000);
  assert.equal(result.totalAmount, 200000);
});

test("allows many free vouchers but rejects a second percentage voucher", () => {
  const free = (code) => ({
    code,
    campaignId: "campaign-free",
    campaignName: "Tặng vé",
    rewardType: "FREE_TICKET",
    rewardValue: 0,
    product,
  });
  assert.equal(
    calculateVoucherDiscount(
      [{ ...product, quantity: 2 }],
      [free("FREE-001"), free("FREE-002")],
    ).totalAmount,
    0,
  );

  const percent = (code) => ({
    ...free(code),
    rewardType: "DISCOUNT_PERCENT",
    rewardValue: 10,
  });
  assert.throws(() => calculateVoucherDiscount(
    [{ ...product, quantity: 2 }],
    [percent("PERCENT-001"), percent("PERCENT-002")],
  ));
});
