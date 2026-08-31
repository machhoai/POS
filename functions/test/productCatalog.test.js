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
    "2026-07-31T00:00:00.000Z",
    new Map([
      ["TICKET-01", { foreColor: "#743535", backColor: "#465288" }],
    ]),
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
      typeId: "",
      foreColor: "#743535",
      backColor: "#465288",
      typeName: "Vé một lượt",
      groupKey: "category:4:name:vé một lượt",
      isEnabled: true,
      isOpenSales: true,
      isCategoryEnabled: true,
      syncStatus: "active",
      disabledReason: null,
      lastSyncAt: "2026-07-31T00:00:00.000Z",
    },
  ]);
});

test("maps the authoritative ticket quantity from the management catalog", () => {
  const products = mapGroupedGoods(
    [
      {
        goodsId: "COMBO-07",
        goodsName: "Combo 7 games",
        price: 700000,
        subCategory: 1,
      },
    ],
    4,
    "Combo",
    "2026-08-11T00:00:00.000Z",
    new Map([
      ["COMBO-07", { ticketsPerUnit: 7 }],
    ]),
  );

  assert.equal(products.length, 1);
  assert.equal(products[0].ticketsPerUnit, 7);
  assert.equal(products[0].amount, undefined);
});

test("keeps synchronized package principal and bonus values with its metadata", () => {
  const products = mapGroupedGoods(
    [{ goodsId: "POINT-01", goodsName: "Point package", price: 100000 }],
    1,
    "Member package",
    "2026-08-11T00:00:00.000Z",
    new Map([["POINT-01", { principalPoints: 1210, bonusPoints: 435 }]]),
  );

  assert.equal(products[0].principalPoints, 1210);
  assert.equal(products[0].bonusPoints, 435);
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
      groupKey: "category:10:name:souvenirs",
      amount: 12,
      giftNo: "JWG-001",
      isEnabled: true,
      isOpenSales: true,
      isCategoryEnabled: true,
      syncStatus: "active",
      disabledReason: null,
      lastSyncAt: "2026-07-31T00:00:00.000Z",
    },
  ]);
});

test("marks a remotely disabled ticket as hidden while retaining its record", () => {
  const products = mapGroupedGoods(
    [{ goodsId: "TICKET-OFF", goodsName: "Disabled ticket", price: 100 }],
    4,
    "Tickets",
    "2026-08-20T00:00:00.000Z",
    new Map([[
      "TICKET-OFF",
      { isEnabled: false, isOpenSales: true, typeId: "TYPE-01" },
    ]]),
    "TYPE-01",
    true,
  );

  assert.equal(products[0].isEnabled, false);
  assert.equal(products[0].syncStatus, "disabled");
  assert.equal(products[0].disabledReason, "product_disabled");
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
