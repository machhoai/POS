const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createProductSyncSignature,
  productSyncSignaturesMatch,
} = require("../lib/services/productSyncAuthentication");

test("signs the exact timestamp, request id, and request body", () => {
  const signature = createProductSyncSignature(
    "secret",
    "1725760800000",
    "request-1",
    '{"actor_id":"admin"}',
  );
  assert.equal(
    signature,
    "4d2895184894149aa6a85a3c898258c90516c35abf97db75f9f3328a2f48feb2",
  );
  assert.equal(productSyncSignaturesMatch(signature, signature), true);
  assert.equal(productSyncSignaturesMatch("wrong", signature), false);
});
