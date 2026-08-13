/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildVietQrQuickLink,
  normalizeFixedTransferSettings,
} = require("../lib/payment/fixedTransferPolicy");

test("normalizes fixed transfer settings before persistence", () => {
  assert.deepEqual(
    normalizeFixedTransferSettings({
      deviceId: " DEVICE-01 ",
      warehouseId: " WH-01 ",
      enabled: true,
      fixedTransferOnly: true,
      bankBin: "970 436",
      accountNumber: "123 456 789",
      accountName: "  CONG   TY POS  ",
    }),
    {
      deviceId: "DEVICE-01",
      warehouseId: "WH-01",
      enabled: true,
      fixedTransferOnly: true,
      bankBin: "970436",
      accountNumber: "123456789",
      accountName: "CONG TY POS",
    },
  );
});

test("rejects invalid bank and account identifiers", () => {
  const valid = {
    deviceId: "DEVICE-01",
    warehouseId: "WH-01",
    enabled: true,
    fixedTransferOnly: false,
    bankBin: "970436",
    accountNumber: "123456789",
    accountName: "CONG TY POS",
  };

  assert.throws(
    () => normalizeFixedTransferSettings({ ...valid, bankBin: "97043" }),
    /6/,
  );
  assert.throws(
    () => normalizeFixedTransferSettings({ ...valid, accountNumber: "123" }),
    /6.*19/,
  );
});

test("requires fixed transfer to be enabled for fixed-only mode", () => {
  assert.throws(
    () => normalizeFixedTransferSettings({
      deviceId: "DEVICE-01",
      warehouseId: "WH-01",
      enabled: false,
      fixedTransferOnly: true,
      bankBin: "970436",
      accountNumber: "123456789",
      accountName: "CONG TY POS",
    }),
    /Phải bật QR tài khoản cố định/,
  );
});

test("requires a POS device id for device-scoped settings", () => {
  assert.throws(
    () => normalizeFixedTransferSettings({
      deviceId: " ",
      warehouseId: "WH-01",
      enabled: true,
      fixedTransferOnly: false,
      bankBin: "970436",
      accountNumber: "123456789",
      accountName: "CONG TY POS",
    }),
    /Máy POS/,
  );
});

test("builds a VietQR Quick Link with exact amount and transfer content", () => {
  const url = new URL(buildVietQrQuickLink({
    bankBin: "970436",
    accountNumber: "123456789",
    accountName: "CONG TY POS",
    amount: 150000,
    description: "JWC01 000000ABC123",
  }));

  assert.equal(url.origin, "https://img.vietqr.io");
  assert.equal(url.pathname, "/image/970436-123456789-compact2.png");
  assert.equal(url.searchParams.get("amount"), "150000");
  assert.equal(url.searchParams.get("addInfo"), "JWC01 000000ABC123");
  assert.equal(url.searchParams.get("accountName"), "CONG TY POS");
});

test("rejects a non-positive or fractional VietQR amount", () => {
  const input = {
    bankBin: "970436",
    accountNumber: "123456789",
    accountName: "CONG TY POS",
    description: "JWC01 000000ABC123",
  };

  assert.throws(() => buildVietQrQuickLink({ ...input, amount: 0 }));
  assert.throws(() => buildVietQrQuickLink({ ...input, amount: 1.5 }));
});
