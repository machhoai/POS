import assert from "node:assert/strict";
import test from "node:test";

import { encodeCode39 } from "../src/features/lucky-draw/helpers/code39Barcode.ts";

test("encodes JPOS order IDs as a non-empty Code 39 barcode", () => {
  const barcode = encodeCode39("ORD-1770000000000-ABC123");
  assert.ok(barcode.width > 0);
  assert.ok(barcode.bars.length > 20);
  assert.ok(barcode.bars.every((bar) => bar.width === 1 || bar.width === 3));
});

test("rejects characters outside the Code 39 alphabet", () => {
  assert.throws(() => encodeCode39("đơn-hàng"), /không hỗ trợ/);
});
