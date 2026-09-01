import assert from "node:assert/strict";
import test from "node:test";

import {
  logCheckoutTelemetry,
  readCheckoutTelemetry,
  setCheckoutTelemetryDeviceContext,
} from "../src/lib/services/checkoutTelemetryService.ts";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

test("checkout telemetry keeps ordered payment-to-print timing without customer data", () => {
  const originalWindow = global.window;
  const originalConsoleInfo = console.info;
  global.window = { localStorage: new MemoryStorage() };
  console.info = () => {};

  try {
    setCheckoutTelemetryDeviceContext({
      deviceId: "device-1",
      warehouseId: "warehouse-1",
    });
    const payment = logCheckoutTelemetry("payment_detected", {
      localOrderId: "ORD-TEST-1",
      orderKind: "MEMBER_PACKAGE",
      details: { paymentMethod: "PAYOS" },
    });
    const orderLoaded = logCheckoutTelemetry("order_loaded", {
      localOrderId: "ORD-TEST-1",
      orderKind: "MEMBER_PACKAGE",
    });
    const receipt = logCheckoutTelemetry("receipt_dispatched", {
      localOrderId: "ORD-TEST-1",
      orderKind: "MEMBER_PACKAGE",
    });

    assert.equal(payment.durationSincePaymentMs, 0);
    assert.ok(orderLoaded.durationSincePaymentMs >= 0);
    assert.ok(receipt.durationSincePreviousMs >= 0);
    assert.equal(receipt.deviceId, "device-1");
    assert.equal(receipt.warehouseId, "warehouse-1");
    assert.deepEqual(
      readCheckoutTelemetry().map((entry) => entry.event),
      ["payment_detected", "order_loaded", "receipt_dispatched"],
    );
    assert.equal("member" in receipt, false);
    assert.equal("phone" in receipt, false);
  } finally {
    console.info = originalConsoleInfo;
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});
