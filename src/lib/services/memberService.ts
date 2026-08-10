import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { withDeviceAuth } from "@/lib/services/deviceEnrollmentService";
import type {
  MemberLookupMode,
  MemberProfile,
  MemberRegistrationDraft,
} from "@/lib/types/member";

export interface MemberLookupInput {
  shopId: number;
  warehouseId: string;
  mode: MemberLookupMode;
  query: string;
}

export interface MemberLookupResult {
  member: MemberProfile;
  fetchedAt: string;
}

export interface MemberRegistrationInput extends MemberRegistrationDraft {
  shopId: number;
  warehouseId: string;
}

export interface MemberRegistrationResult {
  member: MemberProfile;
  remoteMessage: string | null;
  createdAt: string;
}

export class MemberServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "MemberServiceError";
  }
}

function normalizeLookupQuery(mode: MemberLookupMode, query: string): string {
  const normalized = mode === "PHONE"
    ? query.trim().replace(/[\s().-]/g, "")
    : query.trim();

  if (mode === "PHONE" && !/^\+?\d{8,15}$/.test(normalized)) {
    throw new MemberServiceError(
      "Số điện thoại phải gồm 8 đến 15 chữ số.",
      "invalid-phone",
    );
  }
  if (mode === "CARD" && (!normalized || normalized.length > 64)) {
    throw new MemberServiceError("Mã thẻ không hợp lệ.", "invalid-card");
  }
  return normalized;
}

function readErrorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown";
  return String((error as { code?: unknown }).code || "unknown");
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Không thể xử lý yêu cầu thành viên. Vui lòng thử lại.";
}

export function validateMemberRegistrationDraft(
  draft: MemberRegistrationDraft,
): MemberRegistrationDraft {
  const fullName = draft.fullName.trim();
  const phone = draft.phone.trim().replace(/[\s().-]/g, "");
  const email = draft.email.trim().toLowerCase();
  if (!fullName || fullName.length > 120) {
    throw new MemberServiceError("Họ tên khách hàng không hợp lệ.", "invalid-name");
  }
  if (!/^\+?\d{8,15}$/.test(phone)) {
    throw new MemberServiceError("Số điện thoại phải gồm 8 đến 15 chữ số.", "invalid-phone");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new MemberServiceError("Email không đúng định dạng.", "invalid-email");
  }
  if (draft.birthDate) {
    const parsed = new Date(`${draft.birthDate}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== draft.birthDate ||
      parsed.getTime() > Date.now()
    ) {
      throw new MemberServiceError("Ngày sinh không hợp lệ.", "invalid-birth-date");
    }
  }
  return { ...draft, fullName, phone, email };
}

export function toMemberServiceError(error: unknown): MemberServiceError {
  if (error instanceof MemberServiceError) return error;
  const code = readErrorCode(error);
  const remoteMessage = readErrorMessage(error);
  if (code.includes("unauthenticated")) {
    return new MemberServiceError("Phiên đăng nhập đã hết hạn.", code);
  }
  if (code.includes("permission-denied")) {
    return new MemberServiceError(
      "Bạn không có quyền thao tác thành viên tại điểm bán này.",
      code,
    );
  }
  if (code.includes("not-found") || code.includes("failed-precondition")) {
    return new MemberServiceError(remoteMessage, code);
  }
  if (code.includes("unavailable")) {
    return new MemberServiceError(
      remoteMessage || "Không thể kết nối OpenAPI. Vui lòng thử lại.",
      code,
    );
  }
  return new MemberServiceError(remoteMessage, code);
}

export async function lookupMember(
  input: MemberLookupInput,
): Promise<MemberLookupResult> {
  const callable = httpsCallable<
    { action: "lookupMember"; payload: MemberLookupInput },
    MemberLookupResult
  >(
    functions,
    "getPosAuthSession",
  );

  try {
    const result = await callable(await withDeviceAuth({
      action: "lookupMember" as const,
      payload: {
        ...input,
        query: normalizeLookupQuery(input.mode, input.query),
      },
    }));
    return result.data;
  } catch (error: unknown) {
    throw toMemberServiceError(error);
  }
}

export async function registerMember(
  input: MemberRegistrationInput,
): Promise<MemberRegistrationResult> {
  const draft = validateMemberRegistrationDraft(input);
  type RegistrationPayload = Omit<
    MemberRegistrationInput,
    "birthDate" | "email"
  > & {
    birthDate: string | null;
    email: string | null;
  };
  const callable = httpsCallable<
    { action: "registerMember"; payload: RegistrationPayload },
    MemberRegistrationResult
  >(functions, "getPosAuthSession");

  try {
    const result = await callable(await withDeviceAuth({
      action: "registerMember" as const,
      payload: {
        ...input,
        ...draft,
        birthDate: draft.birthDate || null,
        email: draft.email || null,
      },
    }));
    return result.data;
  } catch (error: unknown) {
    throw toMemberServiceError(error);
  }
}
