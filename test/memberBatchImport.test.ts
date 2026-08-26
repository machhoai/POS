import test from "node:test";
import assert from "node:assert/strict";
import { parseMemberBatchRows } from "../src/features/member-batch/helpers/memberBatchImport.ts";
import { requiresCardReread } from "../src/features/member-batch/helpers/memberBatchSafety.ts";

test("parses Vietnamese Excel columns and restores a lost leading zero", () => {
  const result = parseMemberBatchRows([
    ["Họ và tên", "Số điện thoại", "Giới tính", "Ngày sinh", "Email", "Số điểm cần nạp"],
    ["Nguyễn Văn A", 901234567, "Nam", "20/05/1990", "A@EXAMPLE.COM", 125],
    ["Trần Thị B", "0901234568", "Nữ", "1995-08-12", "", 0],
  ]);

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows[0], {
    rowNumber: 2,
    fullName: "Nguyễn Văn A",
    phone: "0901234567",
    gender: "MALE",
    birthDate: "1990-05-20",
    email: "a@example.com",
    points: 125,
  });
  assert.equal(result.rows[1]?.gender, "FEMALE");
  assert.equal(result.rows[1]?.birthDate, "1995-08-12");
});

test("rejects duplicated phones and invalid point values", () => {
  const result = parseMemberBatchRows([
    ["Họ tên", "SĐT", "Giới tính", "Điểm"],
    ["Khách A", "0901234567", "Nam", 100],
    ["Khách B", "0901234567", "Nữ", -1],
  ]);

  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]?.message ?? "", /Trùng số điện thoại/);
  assert.match(result.errors[0]?.message ?? "", /Số điểm/);
});

test("reports missing required headers before parsing data", () => {
  const result = parseMemberBatchRows([["Họ và tên", "Số điện thoại"]]);
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 2);
});

test("requires a card reread until Joyworld has confirmed the attachment", () => {
  assert.equal(requiresCardReread("AWAITING_CARD"), true);
  assert.equal(requiresCardReread("MEMBER_CREATED"), true);
  assert.equal(requiresCardReread("CARD_ATTACHED"), false);
  assert.equal(requiresCardReread("COMPLETED"), false);
});

