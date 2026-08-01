/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mapGroupedGoods,
  mapSellableSouvenirs,
} = require("../lib/services/productCatalog");

test("maps package products with the HK classification name", () => {
  const products = mapGroupedGoods(
    [
      {
        goodsId: "TICKET-01",
        goodsName: "Vé một lượt 100K",
        price: "100000",
        subCategory: 1,
      },
    ],
    4,
    "Vé một lượt",
    "2026-07-31T00:00:00.000Z"
  );

  assert.deepEqual(products, [
    {
      goodsId: "TICKET-01",
      goodsName: "Vé một lượt 100K",
      description: "",
      price: 100000,
      afterTaxPrice: 100000,
      category: 4,
      subCategory: "1",
      typeName: "Vé một lượt",
      lastSyncAt: "2026-07-31T00:00:00.000Z",
    },
  ]);
});

test("maps only enabled souvenirs with a positive after-tax price", () => {
  const products = mapSellableSouvenirs(
    [
      {
        goodsId: "gift-id-001",
        giftName: "B.Duck badge",
        giftNo: "JWG-001",
        typeName: "Souvenirs",
        stockAmount: 12,
        price: 69000,
        afterTaxPrice: 75900,
        isEnabled: true,
        isOpenSales: true,
      },
      {
        goodsId: "gift-id-002",
        giftName: "Free gift",
        giftNo: "JWG-002",
        price: 0,
        afterTaxPrice: 0,
        isEnabled: true,
        isOpenSales: false,
      },
      {
        goodsId: "gift-id-003",
        giftName: "Missing sale price",
        giftNo: "JWG-003",
        price: 50000,
        isEnabled: true,
        isOpenSales: true,
      },
    ],
    "2026-07-31T00:00:00.000Z"
  );

  assert.deepEqual(products, [
    {
      goodsId: "gift-id-001",
      goodsName: "B.Duck badge",
      price: 69000,
      afterTaxPrice: 75900,
      category: 10,
      subCategory: "Souvenirs",
      typeName: "Souvenirs",
      amount: 12,
      giftNo: "JWG-001",
      lastSyncAt: "2026-07-31T00:00:00.000Z",
    },
  ]);
});

test("uses the catalog goodsId and preserves before/after-tax prices", () => {
  const products = mapSellableSouvenirs(
    [
      {
        goodsId: "catalog-gift-id",
        giftName: "Duck plush",
        giftNo: "DUCK-01",
        typeName: "Retail",
        stockAmount: "7",
        price: "120000",
        afterTaxPrice: "132000",
        isEnabled: true,
        isOpenSales: true,
      },
    ],
    "2026-07-31T00:00:00.000Z"
  );

  assert.equal(products.length, 1);
  assert.equal(products[0].goodsId, "catalog-gift-id");
  assert.equal(products[0].amount, 7);
  assert.equal(products[0].price, 120000);
  assert.equal(products[0].afterTaxPrice, 132000);
});
