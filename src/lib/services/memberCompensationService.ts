import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { withDeviceAuth } from "@/lib/services/deviceEnrollmentService";
import { MemberServiceError, toMemberServiceError } from "@/lib/services/memberService";
import type {
  MemberCompensationDraft,
  MemberCompensationInput,
  MemberCompensationResult,
  MemberManualCompensationCategory,
} from "@/lib/types/member";

export function validateMemberCompensationDraft(
  draft: MemberCompensationDraft,
): { storedCategory: MemberManualCompensationCategory; amount: number; reason: string } {
  if (draft.storedCategory !== 1 && draft.storedCategory !== 6) {
    throw new MemberServiceError(
      "Cột nạp bù phải là Tiền hoặc Lượt.",
      "invalid-compensation-category",
    );
  }
  if (
    !Number.isInteger(draft.amount) ||
    Number(draft.amount) === 0 ||
    Math.abs(Number(draft.amount)) > 10_000_000
  ) {
    throw new MemberServiceError(
      "Số lượng điều chỉnh phải là số nguyên khác 0, từ -10.000.000 đến 10.000.000.",
      "invalid-compensation-amount",
    );
  }
  const reason = draft.reason.trim();
  if (reason.length < 5 || reason.length > 500) {
    throw new MemberServiceError(
      "Lý do nạp bù phải có từ 5 đến 500 ký tự.",
      "invalid-compensation-reason",
    );
  }
  return {
    storedCategory: draft.storedCategory,
    amount: Number(draft.amount),
    reason,
  };
}

export async function compensateMemberBalance(
  input: MemberCompensationInput,
): Promise<MemberCompensationResult> {
  const callable = httpsCallable<
    { action: "compensateMemberBalance"; payload: MemberCompensationInput },
    MemberCompensationResult
  >(functions, "getPosAuthSession");
  try {
    const result = await callable(await withDeviceAuth({
      action: "compensateMemberBalance" as const,
      payload: input,
    }));
    return result.data;
  } catch (error: unknown) {
    throw toMemberServiceError(error);
  }
}
