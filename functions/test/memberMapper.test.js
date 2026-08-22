/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mapMemberAccounts,
  mapMemberBalances,
  mapMemberCards,
  mapMemberLookup,
  mapMemberPassTickets,
  mapMemberPointPackage,
  mapMemberStoredValueRecords,
} = require("../lib/services/memberMapper");
const {
  hasPlayableMemberPackageCredits,
} = require("../lib/services/memberPackageService");

test("maps the confirmed member balance categories", () => {
  assert.deepEqual(
    mapMemberBalances([
      { category: 101, value: "693" },
      { category: 102, value: 50 },
      { category: 104, value: 11 },
      { category: 105, value: 7 },
      { category: 106, value: 3 },
      { category: 112, value: 9 },
    ]),
    {
      principalVnd: 693,
      bonus: 50,
      totalAvailable: 743,
      turns: 11,
      integral: 7,
      points: 3,
      other: { 112: 9 },
    },
  );
});

test("selects the current shop when mapping a phone lookup", () => {
  const member = mapMemberLookup(
    {
      mid: "member-id",
      phone: "0900000000",
      realName: "Khách thử nghiệm",
      sex: "female",
      items: [
        { shopId: 10, uid: "other-shop" },
        {
          shopId: "20",
          shopName: "Joy World",
          uid: "current-shop",
          levelName: "Gold",
          storedValues: [
            { category: 101, value: 100 },
            { category: 102, value: 20 },
          ],
        },
      ],
    },
    { shopId: 20 },
  );

  assert.equal(member.uid, "current-shop");
  assert.equal(member.gender, "FEMALE");
  assert.equal(member.balances.totalAvailable, 120);
});

test("normalizes member-card balance category variants", () => {
  const balances = mapMemberBalances([
    { category: 4, value: 2 },
    { category: 1006, value: 9 },
  ]);

  assert.equal(balances.turns, 2);
  assert.equal(balances.points, 9);
});

test("preserves the queried card number when the card response omits it", () => {
  const member = mapMemberLookup(
    {
      uid: "card-member",
      phone: "0900000000",
      realName: "Khách dùng thẻ",
      storedValue: [{ category: 101, value: 200 }],
    },
    { memberCode: "CARD-001" },
  );

  assert.equal(member.memberCode, "CARD-001");
  assert.equal(member.balances.principalVnd, 200);
});

test("maps stored-value history with an absolute movement amount", () => {
  const records = mapMemberStoredValueRecords([{
    createTime: "2026-08-10 10:30:20",
    flowType: 2,
    businessType: 2001,
    businessTypeName: "Chơi máy",
    beforeAmount: 1500,
    amount: -50,
    afterAmount: 1450,
    remark: "Sử dụng 50 điểm",
  }], 1);

  assert.equal(records[0].storedCategory, 1);
  assert.equal(records[0].flowType, 2);
  assert.equal(records[0].amount, 50);
  assert.equal(records[0].afterAmount, 1450);
});

test("maps current cards and member pass tickets", () => {
  const cards = mapMemberCards([{
    category: 1,
    memberCode: "CARD-001",
    icCard: "IC-001",
    remark: "Thẻ vật lý",
  }]);
  const tickets = mapMemberPassTickets([{
    passticketId: "ticket-01",
    passticketName: "Vé 10 lượt",
    passticketCategory: 1,
    buyAmount: 10,
    enabledAmount: 8,
    buyTime: "2026-08-01 09:00:00",
  }]);

  assert.equal(cards[0].memberCode, "CARD-001");
  assert.equal(tickets[0].name, "Vé 10 lượt");
  assert.equal(tickets[0].enabledAmount, 8);
});

test("maps total points as package amount plus configured give amounts", () => {
  const accounts = mapMemberAccounts([
    { key: "principal", value: "VND", extendAttr: 1, unit: "Đồng" },
    { key: "bonus", value: "赠币", extendAttr: 2, unit: "Đồng" },
    { key: "turns", value: "Lượt", extendAttr: 4, unit: "Một" },
    { key: "points", value: "Điểm", extendAttr: 6, unit: "Trương" },
  ]);
  assert.equal(accounts.find((account) => account.accountId === "turns").bucket, "TURNS");
  assert.equal(accounts.find((account) => account.accountId === "points").bucket, "POINTS");
  const result = mapMemberPointPackage({
    listItem: {
      goodsId: "silver-50",
      goodsName: "GSM: Silver +50",
      category: 1,
      remark: "",
    },
    detail: {
      setMealId: "silver-50",
      price: 1100000,
      afterTaxPrice: 1210000,
      amount: 1210,
      givecoin1: 0,
      giveConfigs: [
        { shopAcctId: "bonus", giveAmount: 435, effectiveMode: 1, effectiveDays: 0 },
      ],
    },
    precalculation: {
      totalOriginalMoney: 1210000,
      totalDiscountMoney: 0,
      totalMoney: 1210000,
    },
    accounts,
  });

  assert.equal(result.paymentAmountVnd, 1210000);
  assert.equal(result.principalPoints, 1210);
  assert.equal(result.bonusBucketPoints, 435);
  assert.equal(result.totalPoints, 1645);
  assert.equal(result.extraBonusPoints, null);
});

test("excludes category-one products that do not grant playable points", () => {
  const result = mapMemberPointPackage({
    listItem: { goodsId: "birthday", goodsName: "Gói sinh nhật" },
    detail: { setMealId: "birthday", giveConfigs: [] },
    precalculation: { totalMoney: 21000000 },
    accounts: [],
  });

  assert.equal(result, null);
});

test("checks playable package credits before requesting a price calculation", () => {
  assert.equal(hasPlayableMemberPackageCredits({
    amount: 1210,
    giveConfigs: [{ shopAcctId: "bonus", giveAmount: 435 }],
  }), true);
  assert.equal(hasPlayableMemberPackageCredits({
    giveConfigs: [],
  }), false);
  assert.equal(hasPlayableMemberPackageCredits({
    amount: -1,
    giveConfigs: [{ shopAcctId: "bonus", giveAmount: 50 }],
  }), false);
});
