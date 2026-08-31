import assert from "node:assert/strict";
import test from "node:test";

import { hasActiveTransfer } from "../src/lib/utils/paymentState.ts";

test("recognizes a PayOS session as an active transfer", () => {
  assert.equal(hasActiveTransfer({
    hasSession: true,
    fixedTransferStatus: null,
    isCartLocked: false,
  }), true);
});

test("recognizes a fixed QR without relying on a cart lock", () => {
  assert.equal(hasActiveTransfer({
    hasSession: false,
    fixedTransferStatus: "AWAITING_MANUAL_CONFIRMATION",
    isCartLocked: false,
  }), true);
});

test("does not keep cancelled or completed fixed transfers active", () => {
  for (const fixedTransferStatus of ["CANCELLED", "MANUALLY_CONFIRMED"]) {
    assert.equal(hasActiveTransfer({
      hasSession: false,
      fixedTransferStatus,
      isCartLocked: false,
    }), false);
  }
});

test("retains checkout recovery when the cart is locked", () => {
  assert.equal(hasActiveTransfer({
    hasSession: false,
    fixedTransferStatus: null,
    isCartLocked: true,
  }), true);
});
