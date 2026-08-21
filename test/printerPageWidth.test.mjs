import assert from "node:assert/strict";
import test from "node:test";

import { resolvePrinterPageWidthMm } from "../src/features/printer/helpers/resolvePrinterPageWidth.ts";

test("BT-T080 uses the empirically safe 72 mm WebView2 media width", () => {
  const printerNames = [
    "ITP080 (SNBC BT-T080)",
    "BT-T080(U) 3",
    "BT-T080(A)",
  ];

  for (const printerName of printerNames) {
    assert.equal(resolvePrinterPageWidthMm(80, printerName), 72);
  }
});

test("XP-80C and Sapo SP01 retain their 72 mm driver limit", () => {
  const printerNames = ["Sapo SP01 (XP-80C)", "XP-80C", "SP01"];

  for (const printerName of printerNames) {
    assert.equal(resolvePrinterPageWidthMm(80, printerName), 72);
  }
});

test("other printer profiles retain their configured width", () => {
  assert.equal(resolvePrinterPageWidthMm(82, "4BARCODE 3B-365B"), 82);
  assert.equal(resolvePrinterPageWidthMm(58, null), 58);
});
