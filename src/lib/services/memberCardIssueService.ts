import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { readMemberCard } from "@/lib/services/cardReaderService";
import { withDeviceAuth } from "@/lib/services/deviceEnrollmentService";

interface MemberCardIssueScope {
  shopId: number;
  warehouseId: string;
}

export type MemberCardPreparationInput = MemberCardIssueScope;

export interface MemberCardIssueInfoInput extends MemberCardIssueScope {
  uid: string;
  lookupQuery: string;
}

export interface MemberCardIssueInfo {
  memberAcctId: string;
  maxReceiveCard: number;
  takeCardNum: number;
}

export interface MemberCardAvailability {
  dynamicSerialNo: string | null;
}

export interface MemberCardIssueCheckInput extends MemberCardIssueScope {
  memberCode: string;
}

export interface ConfirmMemberCardIssueInput extends MemberCardIssueInfoInput {
  memberAcctId: string;
  memberCode: string;
  memberIcCard: string;
  dynamicSerialNo: string | null;
}

export interface PreparedMemberCard {
  memberCode: string;
  memberIcCard: string;
  dynamicSerialNo: string | null;
}

export type MemberCardPreparationPhase = "READING" | "VERIFYING";

export interface ConfirmMemberCardIssueResult {
  message: string;
}

export class MemberCardIssueServiceError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "MemberCardIssueServiceError";
  }
}

function readErrorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown";
  return String((error as { code?: unknown }).code || "unknown");
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Không thể xử lý yêu cầu cấp thẻ. Vui lòng thử lại.";
}

export function toMemberCardIssueServiceError(
  error: unknown,
): MemberCardIssueServiceError {
  if (error instanceof MemberCardIssueServiceError) return error;
  return new MemberCardIssueServiceError(
    readErrorMessage(error),
    readErrorCode(error),
  );
}

async function callMemberCardAction<
  TInput extends object,
  TResult,
>(
  action:
    | "getMemberCardIssueInfo"
    | "checkMemberCardForIssue"
    | "confirmMemberCardIssue",
  payload: TInput,
): Promise<TResult> {
  const callable = httpsCallable<
    { action: typeof action; payload: TInput },
    TResult
  >(functions, "getPosAuthSession");
  try {
    const result = await callable(await withDeviceAuth({ action, payload }));
    return result.data;
  } catch (error: unknown) {
    throw toMemberCardIssueServiceError(error);
  }
}

export function getMemberCardIssueInfo(
  input: MemberCardIssueInfoInput,
): Promise<MemberCardIssueInfo> {
  return callMemberCardAction<MemberCardIssueInfoInput, MemberCardIssueInfo>(
    "getMemberCardIssueInfo",
    input,
  );
}

export function checkMemberCardForIssue(
  input: MemberCardIssueCheckInput,
): Promise<MemberCardAvailability> {
  return callMemberCardAction<MemberCardIssueCheckInput, MemberCardAvailability>(
    "checkMemberCardForIssue",
    input,
  );
}

function samePhysicalCard(
  left: { memberCode?: string; cardUuid?: string },
  right: { memberCode?: string; cardUuid?: string },
): boolean {
  return Boolean(
    left.memberCode &&
    right.memberCode &&
    left.memberCode === right.memberCode &&
    left.cardUuid &&
    right.cardUuid &&
    left.cardUuid === right.cardUuid,
  );
}

export async function prepareMemberCardForIssue(
  input: MemberCardPreparationInput,
  onPhase?: (phase: MemberCardPreparationPhase) => void,
): Promise<PreparedMemberCard> {
  onPhase?.("READING");
  const firstRead = await readMemberCard(20_000);
  if (!firstRead.memberCode || !firstRead.cardUuid) {
    throw new Error("Đầu đọc không trả đủ mã thẻ và UUID của thẻ Joyworld.");
  }

  onPhase?.("VERIFYING");
  const availability = await checkMemberCardForIssue({
    shopId: input.shopId,
    warehouseId: input.warehouseId,
    memberCode: firstRead.memberCode,
  });
  const verifiedRead = await readMemberCard(
    20_000,
    availability.dynamicSerialNo ?? undefined,
  );
  if (!samePhysicalCard(firstRead, verifiedRead)) {
    throw new Error(
      "Thẻ ở lần xác thực không trùng thẻ vừa đọc. " +
      "Vui lòng giữ nguyên một thẻ trên đầu đọc.",
    );
  }

  return {
    memberCode: firstRead.memberCode,
    memberIcCard: firstRead.cardUuid,
    dynamicSerialNo: availability.dynamicSerialNo,
  };
}

export function confirmMemberCardIssue(
  input: ConfirmMemberCardIssueInput,
): Promise<ConfirmMemberCardIssueResult> {
  return callMemberCardAction<
    ConfirmMemberCardIssueInput,
    ConfirmMemberCardIssueResult
  >("confirmMemberCardIssue", input);
}
