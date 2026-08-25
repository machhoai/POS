/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeLuckyDrawSettings,
  resolveLuckyDrawTicketCount,
} = require("../lib/luckyDraw/luckyDrawSettingsPolicy");

const input = {
  warehouseId: "warehouse-1",
  enabled: true,
  paperSize: "POS80",
  programName: "Bốc thăm hè",
  ticketTitle: "Phiếu bốc thăm trúng thưởng",
  message: "Giữ lại phiếu để tham gia quay số.",
  footerMessage: "Chúc quý khách may mắn!",
  packageTicketCounts: {
    silver: 1,
    platinum: 2,
    diamond: 4,
    disabled: 0,
  },
};

test("normalizes the package-to-ticket mapping", () => {
  const settings = normalizeLuckyDrawSettings(input);
  assert.deepEqual(settings.packageTicketCounts, {
    silver: 1,
    platinum: 2,
    diamond: 4,
  });
});

test("grants tickets only to enabled member-package categories", () => {
  const settings = normalizeLuckyDrawSettings(input);
  assert.equal(resolveLuckyDrawTicketCount(settings, "diamond", 2), 4);
  assert.equal(resolveLuckyDrawTicketCount(settings, "diamond", 4), 0);
  assert.equal(resolveLuckyDrawTicketCount({ ...settings, enabled: false }, "diamond", 2), 0);
});

test("rejects excessive ticket counts", () => {
  assert.throws(
    () => normalizeLuckyDrawSettings({
      ...input,
      packageTicketCounts: { diamond: 51 },
    }),
    /0 đến 50/,
  );
});
