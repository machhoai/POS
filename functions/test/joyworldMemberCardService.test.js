/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  memberDetailsContainPhysicalCard,
  purchaseComplimentaryMemberCard,
} = require("../lib/services/joyworldMemberCardService");

function success(data) {
  return { success: true, data };
}

test("complimentary card purchase follows Jingjian's zero-value order flow", async () => {
  const requests = [];
  const responses = new Map([
    ["/member/cashier/membercard/take/deposit", success([{
      configId: "deposit-1",
      storeCategory: 1,
      amount: 10,
    }])],
    ["/member/cashier/otherorder/getitems", success([{
      goodsId: "card-goods-1",
      amount: 10,
      taxRate: 8,
    }])],
    ["/order/cashier/order/create", success("ORDER-1")],
    ["/member/cashier/otherorder/buycard/create", success(true)],
    ["/system/cashier/paymentmethod/getmethods", success([{
      methodId: "cash-1",
      methodCode: "CashPaymentExecutor",
    }])],
    ["/order/cashier/payment/acct/pay", success("PAY-1")],
    ["/order/cashier/order/refresh", success({ status: 3 })],
    ["/order/cashier/order/complete", success({ tasks: [] })],
  ]);
  const request = async (input) => {
    requests.push(input);
    const response = responses.get(input.path);
    assert.ok(response, `Unexpected request ${input.path}`);
    return response;
  };

  const orderNumber = await purchaseComplimentaryMemberCard({
    shopId: 20692,
    memberAcctId: "acct-1",
    memberLevelId: "level-1",
    memberCode: "01PAYJOYW02401",
    memberIcCard: "card-uuid-1",
  }, request);

  assert.equal(orderNumber, "ORDER-1");
  assert.deepEqual(requests.map((entry) => entry.path), [
    "/member/cashier/membercard/take/deposit",
    "/member/cashier/otherorder/getitems",
    "/order/cashier/order/create",
    "/member/cashier/otherorder/buycard/create",
    "/system/cashier/paymentmethod/getmethods",
    "/order/cashier/payment/acct/pay",
    "/order/cashier/order/refresh",
    "/order/cashier/order/complete",
  ]);
  assert.deepEqual(requests[2].body, {
    memberAcctId: "acct-1",
    category: 4,
    channel: 1,
    items: [{
      goodsId: "card-goods-1",
      amount: 10,
      taxRate: 8,
      qty: 1,
    }],
    isManualDerate: true,
    derateMoney: "10.80",
  });
  assert.deepEqual(requests[3].body, {
    orderNumber: "ORDER-1",
    memberAcctId: "acct-1",
    cardQty: 1,
    isFree: true,
    cardList: [{
      iCCard: "card-uuid-1",
      memberCode: "01PAYJOYW02401",
    }],
  });
  assert.deepEqual(requests[5].body, {
    payMethodId: "cash-1",
    orderNumber: "ORDER-1",
    money: 0,
    remark: "",
    paymentAmount: 0,
    changeAmount: 0,
  });
});

test("complimentary card purchase cancels an unfinished order", async () => {
  const paths = [];
  const request = async (input) => {
    paths.push(input.path);
    if (input.path === "/member/cashier/membercard/take/deposit") {
      return success([{ storeCategory: 1, amount: 0 }]);
    }
    if (input.path === "/member/cashier/otherorder/getitems") {
      return success([{ goodsId: "card-goods-1", taxRate: 0 }]);
    }
    if (input.path === "/order/cashier/order/create") {
      return success("ORDER-2");
    }
    if (input.path === "/order/cashier/order/cancel") {
      return success(true);
    }
    throw new Error("buycard failed");
  };

  await assert.rejects(
    purchaseComplimentaryMemberCard({
      shopId: 20692,
      memberAcctId: "acct-1",
      memberLevelId: "level-1",
      memberCode: "01PAYJOYW02401",
      memberIcCard: "card-uuid-1",
    }, request),
    /buycard failed/,
  );
  assert.equal(paths.at(-1), "/order/cashier/order/cancel");
});

test("a configured zero-price card does not request manual authorization", async () => {
  const requests = [];
  const responses = new Map([
    ["/member/cashier/membercard/take/deposit", success([{
      storeCategory: 1,
      amount: 0,
    }])],
    ["/member/cashier/otherorder/getitems", success([{
      goodsId: "card-goods-1",
      taxRate: 0,
    }])],
    ["/order/cashier/order/create", success("ORDER-3")],
    ["/member/cashier/otherorder/buycard/create", success(true)],
    ["/system/cashier/paymentmethod/getmethods", success([{
      methodId: "cash-1",
      methodCode: "CashPaymentExecutor",
    }])],
    ["/order/cashier/payment/acct/pay", success("PAY-3")],
    ["/order/cashier/order/refresh", success({ status: 3 })],
    ["/order/cashier/order/complete", success({ tasks: [] })],
  ]);
  const request = async (input) => {
    requests.push(input);
    return responses.get(input.path);
  };

  await purchaseComplimentaryMemberCard({
    shopId: 20692,
    memberAcctId: "acct-1",
    memberLevelId: "level-1",
    memberCode: "01PAYJOYW02401",
    memberIcCard: "card-uuid-1",
  }, request);

  assert.equal(requests[2].body.isManualDerate, false);
  assert.equal(requests[2].body.derateMoney, 0);
  assert.equal(requests[3].body.isFree, false);
});

test("recognizes the exact physical card already attached by order completion", () => {
  const details = {
    memberCardOutputs: [{
      memberCode: "01PAYJOYW02401",
      icCard: "card-uuid-1",
      status: 1,
      isEnabled: true,
    }],
  };

  assert.equal(memberDetailsContainPhysicalCard(
    details,
    "01PAYJOYW02401",
    "card-uuid-1",
  ), true);
  assert.equal(memberDetailsContainPhysicalCard(
    details,
    "01PAYJOYW02401",
    "different-card-uuid",
  ), false);
  assert.equal(memberDetailsContainPhysicalCard(
    details,
    "01PAYJOYW09999",
    "card-uuid-1",
  ), false);
});
