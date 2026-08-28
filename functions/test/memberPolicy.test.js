/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createMemberOpenId,
  toRemoteSex,
  validateMemberLookupInput,
  validateMemberCardIssueCheckInput,
  validateMemberCardIssueConfirmInput,
  validateMemberCardIssueInfoInput,
  validateMemberCompensationInput,
  validateMemberPassTicketInput,
  validateMemberProfileUpdateInput,
  validateMemberRegistrationInput,
  validateMemberStoredValueHistoryInput,
} = require("../lib/member/memberPolicy");
const {
  buildRemoteMemberCompensationBody,
  resolveHkApiEndpoint,
} = require("../lib/services/hkApiService");

const scope = { shopId: 3159, warehouseId: "warehouse-01" };

test("normalizes phone lookup input", () => {
  assert.deepEqual(
    validateMemberLookupInput({
      ...scope,
      mode: "PHONE",
      query: "090 123-4567",
    }),
    {
      ...scope,
      mode: "PHONE",
      query: "0901234567",
    },
  );
});

test("rejects an invalid member lookup", () => {
  assert.throws(
    () => validateMemberLookupInput({ ...scope, mode: "PHONE", query: "123" }),
    /Số điện thoại không đúng định dạng/,
  );
});

test("validates a card serial lookup from the Decard reader", () => {
  assert.deepEqual(
    validateMemberLookupInput({
      ...scope,
      mode: "CARD",
      query: "3982990773",
      cardLookupKind: "SERIAL_NUMBER",
    }),
    {
      ...scope,
      mode: "CARD",
      query: "3982990773",
      cardLookupKind: "SERIAL_NUMBER",
    },
  );
  assert.throws(
    () => validateMemberLookupInput({
      ...scope,
      mode: "CARD",
      query: "CARD-01",
      cardLookupKind: "SERIAL_NUMBER",
    }),
    /Serial thẻ không đúng định dạng/,
  );
});

test("keeps manually entered cards on the member-code lookup path", () => {
  assert.deepEqual(
    validateMemberLookupInput({
      ...scope,
      mode: "CARD",
      query: "MR01PAY020000059",
    }),
    {
      ...scope,
      mode: "CARD",
      query: "MR01PAY020000059",
      cardLookupKind: "MEMBER_CODE",
    },
  );
});

test("validates member card issue requests without pricing fields", () => {
  assert.deepEqual(validateMemberCardIssueInfoInput({
    ...scope,
    uid: "member-01",
    lookupQuery: "0938571951",
  }), {
    ...scope,
    uid: "member-01",
    lookupQuery: "0938571951",
  });
  assert.deepEqual(validateMemberCardIssueCheckInput({
    ...scope,
    memberCode: "01PAYJOYW003467",
  }), {
    ...scope,
    memberCode: "01PAYJOYW003467",
  });
  const confirm = validateMemberCardIssueConfirmInput({
    ...scope,
    uid: "member-01",
    lookupQuery: "0938571951",
    memberAcctId: "acct-01",
    memberCode: "01PAYJOYW003467",
    memberIcCard: "card-uuid-01",
    dynamicSerialNo: "dynamic-01",
    unitPrice: 999,
    surplusQty: 0,
  });
  assert.equal(confirm.memberCode, "01PAYJOYW003467");
  assert.equal(confirm.dynamicSerialNo, "dynamic-01");
  assert.equal("unitPrice" in confirm, false);
  assert.equal("surplusQty" in confirm, false);

  const withoutDynamicSerial = validateMemberCardIssueConfirmInput({
    ...scope,
    uid: "member-01",
    lookupQuery: "0938571951",
    memberAcctId: "acct-01",
    memberCode: "01PAYJOYW003467",
    memberIcCard: "card-uuid-01",
    dynamicSerialNo: null,
  });
  assert.equal(withoutDynamicSerial.dynamicSerialNo, null);
});

test("rejects incomplete member card issue requests", () => {
  assert.throws(
    () => validateMemberCardIssueCheckInput({ ...scope, memberCode: "" }),
    /Mã thẻ mới không hợp lệ/,
  );
  assert.throws(
    () => validateMemberCardIssueConfirmInput({
      ...scope,
      uid: "member-01",
      lookupQuery: "0938571951",
      memberAcctId: "acct-01",
      memberCode: "01PAYJOYW003467",
    }),
    /UUID thẻ không hợp lệ/,
  );
});

test("validates and normalizes a member compensation request", () => {
  const input = validateMemberCompensationInput({
    ...scope,
    operationId: "019fe98d-d856-7c63-9404-6c0587d0c4ac",
    uid: "member-01",
    memberCode: "CARD-01",
    memberName: "Nguyễn Văn A",
    storedCategory: 1,
    amount: 50,
    reason: "Bù số dư do lỗi ghi thẻ",
    actionTime: "2026-08-10T10:30:20+07:00",
  });

  assert.equal(input.amount, 50);
  assert.equal(input.storedCategory, 1);
  assert.equal(input.reason, "Bù số dư do lỗi ghi thẻ");
  assert.equal(input.actionTime, "2026-08-10T03:30:20.000Z");

  const deduction = validateMemberCompensationInput({
    ...input,
    operationId: "019fe98d-d856-7c63-9404-6c0587d0c4ad",
    amount: -25,
  });
  assert.equal(deduction.amount, -25);
});

test("rejects invalid compensation amounts, reasons, and operation ids", () => {
  const base = {
    ...scope,
    operationId: "019fe98d-d856-7c63-9404-6c0587d0c4ac",
    uid: "member-01",
    memberCode: null,
    memberName: "Nguyễn Văn A",
    storedCategory: 1,
    amount: 50,
    reason: "Bù lỗi thẻ",
    actionTime: "2026-08-10T03:30:20.000Z",
  };
  assert.throws(
    () => validateMemberCompensationInput({ ...base, amount: 0 }),
    /Số lượng điều chỉnh không hợp lệ/,
  );
  assert.throws(
    () => validateMemberCompensationInput({ ...base, amount: -10_000_001 }),
    /Số lượng điều chỉnh không hợp lệ/,
  );
  assert.throws(
    () => validateMemberCompensationInput({ ...base, reason: "lỗi" }),
    /ít nhất 5 ký tự/,
  );
  assert.throws(
    () => validateMemberCompensationInput({ ...base, operationId: "retry-1" }),
    /Mã thao tác nạp bù không hợp lệ/,
  );
  assert.throws(
    () => validateMemberCompensationInput({ ...base, storedCategory: 5 }),
    /Cột điều chỉnh phải là Tiền, Lượt hoặc Điểm/,
  );
});

test("defaults legacy member compensation requests to the turns column", () => {
  const input = validateMemberCompensationInput({
    ...scope,
    operationId: "019fe98d-d856-7c63-9404-6c0587d0c4ac",
    uid: "member-01",
    memberCode: null,
    memberName: "Nguyễn Văn A",
    amount: 1,
    reason: "Bù lỗi thẻ",
    actionTime: "2026-08-10T03:30:20.000Z",
  });

  assert.equal(input.storedCategory, 6);
});

test("builds the documented member_addstored idempotent payload", () => {
  assert.deepEqual(buildRemoteMemberCompensationBody({
    uid: "member-01",
    operationId: "019fe98d-d856-7c63-9404-6c0587d0c4ac",
    storedCategory: 6,
    amount: 50,
    remark: "Nạp bù thẻ: Bù số dư do lỗi ghi thẻ",
  }), {
    uid: "member-01",
    tradeNo: "019fe98d-d856-7c63-9404-6c0587d0c4ac",
    category: 1004,
    storedCategory: 6,
    storedValue: 50,
    effectiveDays: 0,
    bizCode: "019fe98d-d856-7c63-9404-6c0587d0c4ac",
    remark: "Nạp bù thẻ: Bù số dư do lỗi ghi thẻ",
  });
});

test("builds a compensation payload for the money column", () => {
  assert.equal(buildRemoteMemberCompensationBody({
    uid: "member-01",
    operationId: "019fe98d-d856-7c63-9404-6c0587d0c4ae",
    storedCategory: 1,
    amount: 100_000,
    remark: "Nạp bù tiền thẻ: Bù giao dịch gián đoạn",
  }).storedCategory, 1);
});

test("preserves a negative stored value for point deductions", () => {
  assert.equal(buildRemoteMemberCompensationBody({
    uid: "member-01",
    operationId: "019fe98d-d856-7c63-9404-6c0587d0c4ad",
    storedCategory: 4,
    amount: -50,
    remark: "Điều chỉnh trừ điểm thẻ: Thu hồi điểm nạp thừa",
  }).storedValue, -50);
});

test("validates member stored-value history filters", () => {
  const input = validateMemberStoredValueHistoryInput({
    ...scope,
    uid: "member-01",
    storedCategory: 1,
    startTime: "2026-08-01 00:00:00",
    endTime: "2026-08-10 23:59:59",
    page: 1,
    limit: 20,
  });

  assert.equal(input.uid, "member-01");
  assert.equal(input.storedCategory, 1);
  assert.equal(input.limit, 20);

  const allCategories = validateMemberStoredValueHistoryInput({
    ...scope,
    uid: "member-01",
    storedCategory: "ALL",
    startTime: "2026-08-01 00:00:00",
    endTime: "2026-08-10 23:59:59",
    page: 1,
    limit: 20,
  });
  assert.equal(allCategories.storedCategory, "ALL");

  const bonusHistory = validateMemberStoredValueHistoryInput({
    ...scope,
    uid: "member-01",
    storedCategory: 2,
    startTime: "2026-08-01 00:00:00",
    endTime: "2026-08-10 23:59:59",
    page: 1,
    limit: 20,
  });
  assert.equal(bonusHistory.storedCategory, 2);

  const turnsHistory = validateMemberStoredValueHistoryInput({
    ...scope,
    uid: "member-01",
    storedCategory: 6,
    startTime: "2026-08-01 00:00:00",
    endTime: "2026-08-10 23:59:59",
    page: 1,
    limit: 20,
  });
  assert.equal(turnsHistory.storedCategory, 6);
});

test("rejects reversed history dates and invalid ticket categories", () => {
  assert.throws(
    () => validateMemberStoredValueHistoryInput({
      ...scope,
      uid: "member-01",
      storedCategory: 1,
      startTime: "2026-08-11 00:00:00",
      endTime: "2026-08-10 23:59:59",
      page: 1,
      limit: 20,
    }),
    /Thời gian bắt đầu phải trước thời gian kết thúc/,
  );
  assert.throws(
    () => validateMemberPassTicketInput({ ...scope, uid: "member-01", category: 9 }),
    /Loại vé thành viên không hợp lệ/,
  );
});

test("normalizes registration fields kept by POS", () => {
  const input = validateMemberRegistrationInput({
    ...scope,
    fullName: "  Nguyễn Văn A  ",
    phone: "0901234567",
    memberCode: "  01PAYJOYW003467  ",
    gender: "MALE",
    birthDate: "1995-05-20",
    email: "MEMBER@EXAMPLE.COM",
  });

  assert.equal(input.fullName, "Nguyễn Văn A");
  assert.equal(input.memberCode, "01PAYJOYW003467");
  assert.equal(input.email, "member@example.com");
});

test("keeps member card optional during registration", () => {
  const input = validateMemberRegistrationInput({
    ...scope,
    fullName: "Nguyễn Văn B",
    phone: "0901234568",
    gender: "FEMALE",
    birthDate: null,
    email: null,
  });

  assert.equal(input.memberCode, null);
});

test("validates update identity and maps supported remote genders", () => {
  const input = validateMemberProfileUpdateInput({
    ...scope,
    uid: "remote-member-01",
    mid: "member-01",
    fullName: "Nguyễn Văn A",
    phone: "0901234567",
    gender: "FEMALE",
    birthDate: null,
    email: null,
    memberCode: null,
  });

  assert.equal(input.uid, "remote-member-01");
  assert.equal(toRemoteSex(input.gender), 2);
  assert.equal(toRemoteSex("UNKNOWN"), undefined);
});

test("creates a stable OpenAPI identity without exposing the phone", () => {
  const first = createMemberOpenId("0901234567");
  const second = createMemberOpenId("0901234567");

  assert.equal(first, second);
  assert.equal(first.length, 28);
  assert.equal(first.includes("0901234567"), false);
});

test("normalizes the configured HK endpoint", () => {
  assert.equal(
    resolveHkApiEndpoint("https://example.com"),
    "https://example.com/openapi/action",
  );
  assert.equal(
    resolveHkApiEndpoint("https://example.com/openapi/action"),
    "https://example.com/openapi/action",
  );
});
