/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canClaimRemoteOrderSync,
  canQueueRemoteOrderRetry,
  shouldSynchronizeRemoteOrder,
} = require("../lib/order/orderLifecycle");

test("creating or refreshing a PayOS QR does not start HK synchronization", () => {
  assert.equal(shouldSynchronizeRemoteOrder("DRAFT", "DRAFT"), false);
});

test("a verified local payment starts HK synchronization exactly once", () => {
  assert.equal(shouldSynchronizeRemoteOrder("DRAFT", "LOCAL_PAID"), true);
  assert.equal(shouldSynchronizeRemoteOrder("LOCAL_PAID", "LOCAL_PAID"), false);
  assert.equal(shouldSynchronizeRemoteOrder("LOCAL_PAID", "SYNCING"), false);
});

test("member package orders wait for the synchronous API-first callable", () => {
  assert.equal(
    shouldSynchronizeRemoteOrder("DRAFT", "LOCAL_PAID", "MEMBER_PACKAGE"),
    false,
  );
});

test("a sync worker only claims a current uncancelled local payment", () => {
  assert.equal(canClaimRemoteOrderSync({ status: "LOCAL_PAID" }), true);
  assert.equal(canClaimRemoteOrderSync({ status: "SYNCING" }), false);
  assert.equal(
    canClaimRemoteOrderSync({
      status: "LOCAL_PAID",
      cancellationOperationId: "cancel-1",
    }),
    false,
  );
  assert.equal(
    canClaimRemoteOrderSync({
      status: "LOCAL_PAID",
      paymentStatus: "REFUNDING",
    }),
    false,
  );
  assert.equal(
    canClaimRemoteOrderSync({
      status: "LOCAL_PAID",
      syncStatus: "CANCELLED",
    }),
    false,
  );
});

test("automatic and manual retries skip cancelled or refunding orders", () => {
  assert.equal(canQueueRemoteOrderRetry({ status: "SYNC_FAILED" }), true);
  assert.equal(
    canQueueRemoteOrderRetry({
      status: "SYNC_FAILED",
      cancellationOperationId: "cancel-1",
    }),
    false,
  );
  assert.equal(
    canQueueRemoteOrderRetry({
      status: "SYNC_FAILED",
      paymentStatus: "REFUNDED",
    }),
    false,
  );
});
