/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createMemberOpenId,
  toRemoteSex,
  validateMemberLookupInput,
  validateMemberProfileUpdateInput,
  validateMemberRegistrationInput,
} = require("../lib/member/memberPolicy");
const { resolveHkApiEndpoint } = require("../lib/services/hkApiService");

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

test("normalizes registration fields kept by POS", () => {
  const input = validateMemberRegistrationInput({
    ...scope,
    fullName: "  Nguyễn Văn A  ",
    phone: "0901234567",
    gender: "MALE",
    birthDate: "1995-05-20",
    email: "MEMBER@EXAMPLE.COM",
  });

  assert.equal(input.fullName, "Nguyễn Văn A");
  assert.equal(input.email, "member@example.com");
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
