import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateVoucherProducts,
  isDuplicateVoucherScan,
  VOUCHER_BATCH_IDLE_MS,
  VOUCHER_DUPLICATE_WINDOW_MS,
} from "../src/lib/utils/voucherRedemptionBatch.ts";

test("keeps the redemption batch open for ten seconds after the last scan", () => {
  assert.equal(VOUCHER_BATCH_IDLE_MS, 10_000);
});

const voucher = (code, goodsId, quantity) => ({
  code,
  campaignId: "campaign-1",
  campaignName: "Chiến dịch",
  rewardType: "FREE_TICKET",
  rewardValue: 100,
  product: { goodsId, goodsName: goodsId, price: 0, quantity },
});

test("aggregates products into one order while preserving total ticket quantity", () => {
  assert.deepEqual(
    aggregateVoucherProducts([
      voucher("A", "ticket-a", 1),
      voucher("B", "ticket-a", 2),
      voucher("C", "gift-b", 1),
    ]),
    [
      { goodsId: "ticket-a", quantity: 3 },
      { goodsId: "gift-b", quantity: 1 },
    ],
  );
});

test("rejects a scan while its code is active", () => {
  assert.equal(isDuplicateVoucherScan("ABC", new Set(["ABC"]), new Map(), 10_000), true);
});

test("rejects only recent completed scans", () => {
  const now = 10_000;
  assert.equal(isDuplicateVoucherScan("ABC", new Set(), new Map([["ABC", now - 100]]), now), true);
  assert.equal(
    isDuplicateVoucherScan(
      "ABC",
      new Set(),
      new Map([["ABC", now - VOUCHER_DUPLICATE_WINDOW_MS]]),
      now,
    ),
    false,
  );
});
