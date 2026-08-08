/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
