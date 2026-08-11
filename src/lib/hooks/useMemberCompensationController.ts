import { useCallback, useRef, useState } from "react";
import {
  compensateMemberBalance,
  validateMemberCompensationDraft,
} from "@/lib/services/memberCompensationService";
import { toMemberServiceError } from "@/lib/services/memberService";
import { useMemberStore } from "@/lib/stores/useMemberStore";
import type { MemberProfile } from "@/lib/types/member";
import { showError, showPromise } from "@/lib/utils/toast";

interface UseMemberCompensationControllerInput {
  member: MemberProfile | null;
  shopId: number;
  warehouseId: string | null;
  onSucceeded: () => Promise<void>;
}

const retryCompensation = (): void => {
  const button = document.getElementById("member-compensation-confirm");
  if (button instanceof HTMLButtonElement) button.click();
};

export function useMemberCompensationController({
  member,
  shopId,
  warehouseId,
  onSucceeded,
}: UseMemberCompensationControllerInput) {
  const draft = useMemberStore((state) => state.compensationDraft);
  const mutation = useMemberStore((state) => state.mutation);
  const updateDraft = useMemberStore((state) => state.updateCompensationDraft);
  const resetDraft = useMemberStore((state) => state.resetCompensationDraft);
  const startMutation = useMemberStore((state) => state.startMutation);
  const completeMutation = useMemberStore((state) => state.completeMutation);
  const failMutation = useMemberStore((state) => state.failMutation);
  const resetMutation = useMemberStore((state) => state.resetMutation);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const operationIdRef = useRef<string | null>(null);

  const openConfirmation = useCallback(() => {
    try {
      const normalized = validateMemberCompensationDraft(draft);
      if (!member || !warehouseId) {
        throw new Error("Hãy tra cứu đúng thành viên trước khi nạp bù.");
      }
      updateDraft(normalized);
      resetMutation();
      setConfirmOpen(true);
    } catch (error: unknown) {
      const parsed = toMemberServiceError(error);
      showError("Thông tin nạp bù chưa hợp lệ", parsed.message);
    }
  }, [draft, member, resetMutation, updateDraft, warehouseId]);

  const closeConfirmation = useCallback(() => {
    if (mutation.kind === "COMPENSATION_TOP_UP" && mutation.status === "WAITING_API") return;
    setConfirmOpen(false);
  }, [mutation.kind, mutation.status]);

  const submit = useCallback(async () => {
    if (!member || !warehouseId) return;
    let normalized;
    try {
      normalized = validateMemberCompensationDraft(draft);
    } catch (error: unknown) {
      const parsed = toMemberServiceError(error);
      showError("Thông tin nạp bù chưa hợp lệ", parsed.message);
      return;
    }
    const operationId = operationIdRef.current ?? crypto.randomUUID();
    operationIdRef.current = operationId;
    const isDeduction = normalized.amount < 0;
    startMutation("COMPENSATION_TOP_UP");
    try {
      const result = await showPromise(compensateMemberBalance({
        operationId,
        shopId,
        warehouseId,
        uid: member.uid,
        memberCode: member.memberCode,
        memberName: member.fullName,
        amount: normalized.amount,
        reason: normalized.reason,
        actionTime: new Date().toISOString(),
      }), {
        loading: isDeduction ? "Đang trừ điểm qua OpenAPI..." : "Đang nạp bù qua OpenAPI...",
        success: isDeduction ? "Trừ điểm thành công" : "Nạp bù thành công",
        error: isDeduction ? "Không thể trừ điểm" : "Không thể nạp bù",
        successDescription: "Số dư và lịch sử thành viên đang được cập nhật.",
        errorDescription: "Yêu cầu được giữ nguyên mã để có thể thử lại an toàn.",
        onRetry: retryCompensation,
      });
      completeMutation(result.operationId);
      resetDraft();
      operationIdRef.current = null;
      setConfirmOpen(false);
      await onSucceeded();
    } catch (error: unknown) {
      const parsed = toMemberServiceError(error);
      console.error("[Thành viên] Nạp bù thất bại:", parsed);
      failMutation(parsed.message, parsed.code);
    }
  }, [completeMutation, draft, failMutation, member, onSucceeded, resetDraft, shopId, startMutation, warehouseId]);

  return {
    draft,
    mutation,
    isConfirmOpen,
    updateDraft,
    openConfirmation,
    closeConfirmation,
    submit,
  };
}
