/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mapSellableSouvenirs,
} = require("../lib/services/productCatalog");

test("maps only souvenirs with a positive sale price", () => {
  const products = mapSellableSouvenirs(
    [
      {
        giftName: "B.Duck badge",
        giftNo: "JWG-001",
        typeName: "Souvenirs",
        amount: 12,
        giftPrice: 45000,
        price: 69000,
      },
      {
        giftName: "Free gift",
        giftNo: "JWG-002",
        giftPrice: 50000,
        price: 0,
      },
      {
        giftName: "Missing sale price",
        giftNo: "JWG-003",
        giftPrice: 50000,
      },
    ],
    "2026-07-31T00:00:00.000Z"
  );

  assert.deepEqual(products, [
    {
      goodsId: "JWG-001",
      goodsName: "B.Duck badge",
      price: 69000,
      category: 10,
      subCategory: "Souvenirs",
      typeName: "Souvenirs",
      amount: 12,
      giftNo: "JWG-001",
      lastSyncAt: "2026-07-31T00:00:00.000Z",
    },
  ]);
});

test("uses giftNo as the stable ID and merges stock rows", () => {
  const products = mapSellableSouvenirs(
    [
      {
        GiftName: "Duck plush",
        GiftNo: "DUCK-01",
        TypeName: "Retail",
        Amount: "3",
        Price: "120000",
      },
      {
        giftName: "Duck plush",
        giftNo: "DUCK-01",
        typeName: "Retail",
        amount: 4,
        price: 120000,
      },
    ],
    "2026-07-31T00:00:00.000Z"
  );

  assert.equal(products.length, 1);
  assert.equal(products[0].goodsId, "DUCK-01");
  assert.equal(products[0].amount, 7);
  assert.equal(products[0].price, 120000);
});
