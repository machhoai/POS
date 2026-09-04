/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  APIError,
  BadRequestError,
  ConnectionError,
  ConnectionTimeoutError,
  TooManyRequestError,
} = require("@payos/node");
const { isPayOSUnavailableError } = require("../lib/payment/payosErrors");

const headers = new Headers();

test("allows local cancellation for PayOS availability failures", () => {
  assert.equal(isPayOSUnavailableError(new ConnectionError()), true);
  assert.equal(isPayOSUnavailableError(new ConnectionTimeoutError()), true);
  assert.equal(
    isPayOSUnavailableError(
      new TooManyRequestError(429, {}, "rate limited", headers),
    ),
    true,
  );
  assert.equal(
    isPayOSUnavailableError(new APIError(503, {}, "unavailable", headers)),
    true,
  );
});

test("does not hide PayOS request and business errors as connection failures", () => {
  assert.equal(
    isPayOSUnavailableError(new BadRequestError(400, {}, "invalid", headers)),
    false,
  );
  assert.equal(isPayOSUnavailableError(new Error("Firestore failed")), false);
});
