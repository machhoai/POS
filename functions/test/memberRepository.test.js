/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MEMBER_PROFILE_SCHEMA_VERSION,
  parseStoredMemberProfile,
} = require("../lib/services/memberRepository");

const validProfile = {
  schemaVersion: 1,
  remoteUid: "remote-uid-01",
  mid: null,
  memberCode: null,
  phone: "0901234567",
  fullName: "Nguyễn Văn A",
  gender: "MALE",
  birthDate: "1995-05-20",
  email: "member@example.com",
  shopId: 3159,
  warehouseId: "warehouse-01",
  createdBy: "firebase-user-01",
  updatedBy: "firebase-user-01",
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
  lastRemoteSyncAt: "2026-08-03T00:00:00.000Z",
};

test("parses a valid versioned member profile", () => {
  const result = parseStoredMemberProfile("remote-uid-01", validProfile);

  assert.equal(MEMBER_PROFILE_SCHEMA_VERSION, 1);
  assert.deepEqual(result, validProfile);
});

test("rejects a profile whose document ID differs from remoteUid", () => {
  assert.throws(
    () => parseStoredMemberProfile("another-id", validProfile),
    /Document ID không khớp UID/,
  );
});

test("rejects unsupported schema versions", () => {
  assert.throws(
    () => parseStoredMemberProfile("remote-uid-01", {
      ...validProfile,
      schemaVersion: 2,
    }),
    /Phiên bản hồ sơ thành viên không hỗ trợ/,
  );
});

