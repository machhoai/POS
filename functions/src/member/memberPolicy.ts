import { createHash } from "node:crypto";
import type { MemberGender } from "../types/member";

export type MemberLookupMode = "CARD" | "PHONE";

interface MemberScopeInput {
  shopId: number;
  warehouseId: string;
}

export interface MemberLookupInput extends MemberScopeInput {
  mode: MemberLookupMode;
  query: string;
}

export interface MemberRegistrationInput extends MemberScopeInput {
  fullName: string;
  phone: string;
  gender: MemberGender;
  birthDate: string | null;
  email: string | null;
}

export interface MemberProfileUpdateInput extends MemberRegistrationInput {
  uid: string;
  mid: string | null;
  memberCode: string | null;
}

export class MemberInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberInputError";
  }
}

function inputRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new MemberInputError("Dữ liệu thành viên không hợp lệ.");
  }
  return data as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new MemberInputError(`${label} không hợp lệ.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new MemberInputError(`${label} không hợp lệ.`);
  }
  return normalized;
}

function optionalString(
  value: unknown,
  label: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredString(value, label, maxLength);
}

function normalizePhone(value: unknown): string {
  const rawPhone = requiredString(value, "Số điện thoại", 32);
  const phone = rawPhone.replace(/[\s().-]/g, "");
  if (!/^\+?\d{8,15}$/.test(phone)) {
    throw new MemberInputError("Số điện thoại không đúng định dạng.");
  }
  return phone;
}

function normalizeEmail(value: unknown): string | null {
  const email = optionalString(value, "Email", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new MemberInputError("Email không đúng định dạng.");
  }
  return email?.toLowerCase() ?? null;
}

function normalizeBirthDate(value: unknown): string | null {
  const birthDate = optionalString(value, "Ngày sinh", 10);
  if (!birthDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new MemberInputError("Ngày sinh phải có định dạng YYYY-MM-DD.");
  }
  const parsed = new Date(`${birthDate}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== birthDate ||
    parsed.getTime() > Date.now()
  ) {
    throw new MemberInputError("Ngày sinh không hợp lệ.");
  }
  return birthDate;
}

function normalizeGender(value: unknown): MemberGender {
  if (["MALE", "FEMALE", "OTHER", "UNKNOWN"].includes(String(value))) {
    return String(value) as MemberGender;
  }
  throw new MemberInputError("Giới tính không hợp lệ.");
}

function scopeInput(data: Record<string, unknown>): MemberScopeInput {
  if (!Number.isInteger(data.shopId) || Number(data.shopId) <= 0) {
    throw new MemberInputError("Mã cửa hàng không hợp lệ.");
  }
  return {
    shopId: Number(data.shopId),
    warehouseId: requiredString(data.warehouseId, "Điểm bán", 128),
  };
}

function profileInput(data: Record<string, unknown>): MemberRegistrationInput {
  return {
    ...scopeInput(data),
    fullName: requiredString(data.fullName, "Họ tên", 120),
    phone: normalizePhone(data.phone),
    gender: normalizeGender(data.gender),
    birthDate: normalizeBirthDate(data.birthDate),
    email: normalizeEmail(data.email),
  };
}

export function validateMemberLookupInput(data: unknown): MemberLookupInput {
  const input = inputRecord(data);
  const mode = input.mode;
  if (mode !== "CARD" && mode !== "PHONE") {
    throw new MemberInputError("Phương thức tra cứu thành viên không hợp lệ.");
  }
  const query = mode === "PHONE"
    ? normalizePhone(input.query)
    : requiredString(input.query, "Mã thẻ", 64);
  return { ...scopeInput(input), mode, query };
}

export function validateMemberRegistrationInput(
  data: unknown,
): MemberRegistrationInput {
  return profileInput(inputRecord(data));
}

export function validateMemberProfileUpdateInput(
  data: unknown,
): MemberProfileUpdateInput {
  const input = inputRecord(data);
  return {
    ...profileInput(input),
    uid: requiredString(input.uid, "UID thành viên", 128),
    mid: optionalString(input.mid, "MID thành viên", 128),
    memberCode: optionalString(input.memberCode, "Mã thẻ", 64),
  };
}

/** Stable, non-PII external identity used for idempotent POS registrations. */
export function createMemberOpenId(phone: string): string {
  return createHash("sha256")
    .update(`jpos-member:${phone}`, "utf8")
    .digest("hex")
    .slice(0, 28);
}

export function toRemoteSex(gender: MemberGender): 1 | 2 | undefined {
  if (gender === "MALE") return 1;
  if (gender === "FEMALE") return 2;
  return undefined;
}
