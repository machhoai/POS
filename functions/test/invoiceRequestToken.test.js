const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createInvoiceRequestToken,
  isInvoiceRequestToken,
} = require("../lib/order/invoiceRequestToken");

test("invoice request tokens are opaque 256-bit base64url values", () => {
  const first = createInvoiceRequestToken();
  const second = createInvoiceRequestToken();

  assert.equal(first.length, 43);
  assert.equal(isInvoiceRequestToken(first), true);
  assert.equal(isInvoiceRequestToken(second), true);
  assert.notEqual(first, second);
  assert.equal(isInvoiceRequestToken("ORD-1722740000-ABC123"), false);
});
