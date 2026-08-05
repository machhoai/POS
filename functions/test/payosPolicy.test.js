/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPayOSPaymentDescription,
  canManuallyConfirmPayOSPayment,
  decidePayOSWebhookPayment,
  inferPayOSNextAction,
  isPayOSPaymentAmountValid,
  PAYOS_DESCRIPTION_MAX_LENGTH,
  PAYOS_DISPLAY_WINDOW_MS,
  PAYOS_STORE_CODE_MAX_LENGTH,
} = require("../lib/payment/payosPolicy");

const NOW = Date.parse("2026-08-03T02:00:00.000Z");

test("uses an exact five-minute QR display window", () => {
  assert.equal(PAYOS_DISPLAY_WINDOW_MS, 300000);
});

test("builds the PayOS description from the warehouse business code", () => {
  const localOrderId = "ORD-1750000000000-ABC123";
  const paymentReference = localOrderId.slice(-12);

  assert.equal(
    buildPayOSPaymentDescription("JWC01", localOrderId),
    `JWC01 ${paymentReference}`,
  );
});

test("limits the warehouse code without truncating the payment reference", () => {
  const localOrderId = "ORD-1750000000000-ABC123";
  const paymentReference = localOrderId.slice(-12);
  const description = buildPayOSPaymentDescription(
    "WAREHOUSE-CODE-TOO-LONG",
    localOrderId,
  );

  assert.equal(description, `WAREHO ${paymentReference}`);
  assert.equal(description.split(" ")[0].length, PAYOS_STORE_CODE_MAX_LENGTH);
  assert.ok(description.endsWith(paymentReference));
  assert.ok(description.length <= PAYOS_DESCRIPTION_MAX_LENGTH);
});

test("keeps waiting while both the QR link and display window are active", () => {
  assert.equal(inferPayOSNextAction({
    orderStatus: "DRAFT",
    paymentStatus: "PENDING",
    linkExpiresAt: "2026-08-03T02:15:00.000Z",
    displayExpiresAt: "2026-08-03T02:05:00.000Z",
    nowMs: NOW,
  }), "WAIT");
});

test("offers another five-minute display window before the PayOS link expires", () => {
  assert.equal(inferPayOSNextAction({
    orderStatus: "DRAFT",
    paymentStatus: "PENDING",
    linkExpiresAt: "2026-08-03T02:15:00.000Z",
    displayExpiresAt: "2026-08-03T02:00:00.000Z",
    nowMs: NOW,
  }), "RETRY_DISPLAY");
  assert.equal(inferPayOSNextAction({
    orderStatus: "DRAFT",
    paymentStatus: "PROCESSING",
    linkExpiresAt: "2026-08-03T02:15:00.000Z",
    displayExpiresAt: "2026-08-03T02:00:00.000Z",
    nowMs: NOW,
  }), "RETRY_DISPLAY");
  assert.equal(inferPayOSNextAction({
    orderStatus: "DRAFT",
    paymentStatus: "UNDERPAID",
    linkExpiresAt: "2026-08-03T02:15:00.000Z",
    displayExpiresAt: "2026-08-03T02:00:00.000Z",
    nowMs: NOW,
  }), "RETRY_DISPLAY");
});

test("requires a new QR when the PayOS link is expired or cancelled", () => {
  assert.equal(inferPayOSNextAction({
    orderStatus: "DRAFT",
    paymentStatus: "PENDING",
    linkExpiresAt: "2026-08-03T02:00:00.000Z",
    displayExpiresAt: "2026-08-03T02:00:00.000Z",
    nowMs: NOW,
  }), "RECREATE");
  assert.equal(inferPayOSNextAction({
    orderStatus: "DRAFT",
    paymentStatus: "CANCELLED",
    linkExpiresAt: "2026-08-03T02:15:00.000Z",
    displayExpiresAt: "2026-08-03T02:05:00.000Z",
    nowMs: NOW,
  }), "RECREATE");
});

test("treats paid and downstream synchronization states as completed", () => {
  assert.equal(inferPayOSNextAction({
    orderStatus: "DRAFT",
    paymentStatus: "PAID",
    nowMs: NOW,
  }), "COMPLETED");
  assert.equal(inferPayOSNextAction({
    orderStatus: "SYNC_FAILED",
    paymentStatus: "PENDING",
    nowMs: NOW,
  }), "COMPLETED");
});

test("only accepts an exact positive integer payment amount", () => {
  assert.equal(isPayOSPaymentAmountValid(150000, 150000, 150000), true);
  assert.equal(isPayOSPaymentAmountValid(150000, 150000, 149000), false);
  assert.equal(isPayOSPaymentAmountValid(150000, 140000, 150000), false);
  assert.equal(isPayOSPaymentAmountValid(150000, 150000, 150000.5), false);
});

test("manual confirmation requires the creator and a recent PayOS outage", () => {
  const validInput = {
    orderStatus: "DRAFT",
    isOrderCreator: true,
    paymentStatus: "PENDING",
    lastConnectionErrorAt: "2026-08-03T01:55:00.000Z",
    nowMs: NOW,
  };
  assert.equal(canManuallyConfirmPayOSPayment(validInput), true);
  assert.equal(canManuallyConfirmPayOSPayment({
    ...validInput,
    isOrderCreator: false,
  }), false);
  assert.equal(canManuallyConfirmPayOSPayment({
    ...validInput,
    lastConnectionErrorAt: "2026-08-03T01:49:59.000Z",
  }), false);
  assert.equal(canManuallyConfirmPayOSPayment({
    ...validInput,
    orderStatus: "LOCAL_PAID",
  }), false);
});

test("accepts an exact webhook and treats a repeated webhook as idempotent", () => {
  const validInput = {
    orderStatus: "DRAFT",
    expectedOrderCode: 123456,
    expectedPaymentLinkId: "plink-1",
    expectedAmount: 150000,
    attemptAmount: 150000,
    webhookCode: "00",
    webhookOrderCode: 123456,
    webhookPaymentLinkId: "plink-1",
    webhookAmount: 150000,
    webhookCurrency: "VND",
  };
  assert.equal(decidePayOSWebhookPayment(validInput), "APPLY_PAYMENT");
  assert.equal(decidePayOSWebhookPayment({
    ...validInput,
    orderStatus: "LOCAL_PAID",
  }), "ALREADY_COMPLETED");
});

test("rejects a webhook with the wrong code, link, currency, or amount", () => {
  const validInput = {
    orderStatus: "DRAFT",
    expectedOrderCode: 123456,
    expectedPaymentLinkId: "plink-1",
    expectedAmount: 150000,
    attemptAmount: 150000,
    webhookCode: "00",
    webhookOrderCode: 123456,
    webhookPaymentLinkId: "plink-1",
    webhookAmount: 150000,
    webhookCurrency: "VND",
  };
  assert.equal(decidePayOSWebhookPayment({ ...validInput, webhookCode: "01" }), "REJECT");
  assert.equal(decidePayOSWebhookPayment({ ...validInput, webhookPaymentLinkId: "wrong" }), "REJECT");
  assert.equal(decidePayOSWebhookPayment({ ...validInput, webhookCurrency: "USD" }), "REJECT");
  assert.equal(decidePayOSWebhookPayment({ ...validInput, webhookAmount: 149000 }), "REJECT");
});
