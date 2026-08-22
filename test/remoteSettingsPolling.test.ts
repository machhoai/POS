import assert from "node:assert/strict";
import test from "node:test";

import {
  getRemoteSettingsRetryDelayMs,
  parseRetryAfterMs,
} from "../src/lib/utils/remoteSettingsPolling.ts";

test("parses Retry-After seconds and HTTP dates", () => {
  assert.equal(parseRetryAfterMs("12"), 12_000);
  assert.equal(
    parseRetryAfterMs("Wed, 21 Oct 2026 07:28:00 GMT", Date.parse("2026-10-21T07:27:50Z")),
    10_000,
  );
  assert.equal(parseRetryAfterMs("invalid"), null);
});

test("backs off exponentially with a 60 second ceiling", () => {
  assert.equal(getRemoteSettingsRetryDelayMs(1, null, 0.5), 3_000);
  assert.equal(getRemoteSettingsRetryDelayMs(2, null, 0.5), 6_000);
  assert.equal(getRemoteSettingsRetryDelayMs(6, null, 0.5), 60_000);
});

test("honors a longer server Retry-After delay", () => {
  assert.equal(getRemoteSettingsRetryDelayMs(1, 20_000, 0.5), 20_000);
  assert.equal(getRemoteSettingsRetryDelayMs(6, 120_000, 0.5), 120_000);
});
