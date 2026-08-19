import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { withDeviceAuth } from "@/lib/services/deviceEnrollmentService";

interface MemberCardIssueScope {
  shopId: number;
  warehouseId: string;
}

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
  dynamicSerialNo: string;
}

export interface MemberCardIssueCheckInput extends MemberCardIssueScope {
  memberCode: string;
}

export interface ConfirmMemberCardIssueInput extends MemberCardIssueInfoInput {
  memberAcctId: string;
  memberCode: string;
  memberIcCard: string;
  dynamicSerialNo: string;
}

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

export function confirmMemberCardIssue(
  input: ConfirmMemberCardIssueInput,
): Promise<ConfirmMemberCardIssueResult> {
  return callMemberCardAction<
    ConfirmMemberCardIssueInput,
    ConfirmMemberCardIssueResult
  >("confirmMemberCardIssue", input);
}
