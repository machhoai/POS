import { useCallback, useEffect, useRef } from "react";
import { cancelMemberCardRead, toCardReaderServiceError } from "@/lib/services/cardReaderService";
import {
  confirmMemberCardIssue,
  getMemberCardIssueInfo,
  prepareMemberCardForIssue,
  type PreparedMemberCard,
} from "@/lib/services/memberCardIssueService";
import { compensateMemberBalance } from "@/lib/services/memberCompensationService";
import { registerMember, toMemberServiceError } from "@/lib/services/memberService";
import { useMemberBatchStore } from "@/features/member-batch/store/useMemberBatchStore";
import type { MemberBatchItem } from "@/features/member-batch/types/memberBatch";

interface UseMemberBatchProcessorInput {
  shopId: number;
  warehouseId: string | null;
}

function birthParts(birthDate: string | null): {
  birthDay: string;
  birthMonth: string;
  birthYear: string;
} {
  if (!birthDate) return { birthDay: "", birthMonth: "", birthYear: "" };
  const [birthYear, birthMonth, birthDay] = birthDate.split("-");
  return { birthDay, birthMonth, birthYear };
}

function errorMessage(error: unknown): string {
  const readerError = toCardReaderServiceError(error);
  if (readerError.code !== "UNKNOWN") return readerError.message;
  return toMemberServiceError(error).message;
}

function currentItem(): MemberBatchItem | null {
  const job = useMemberBatchStore.getState().job;
  return job?.items[job.currentIndex] ?? null;
}

function previousAttachedCard(): { memberCode: string; cardUuid: string } | undefined {
  const job = useMemberBatchStore.getState().job;
  if (!job) return undefined;
  const item = [...job.items]
    .slice(0, job.currentIndex)
    .reverse()
    .find((candidate) => candidate.memberCode && candidate.cardUuid);
  return item?.memberCode && item.cardUuid
    ? { memberCode: item.memberCode, cardUuid: item.cardUuid }
    : undefined;
}

function duplicateCard(prepared: PreparedMemberCard): MemberBatchItem | null {
  const job = useMemberBatchStore.getState().job;
  if (!job) return null;
  return job.items.find((item) =>
    item.memberCode === prepared.memberCode && item.cardUuid === prepared.memberIcCard,
  ) ?? null;
}

function pauseWasRequested(): boolean {
  return useMemberBatchStore.getState().job?.status === "PAUSE_REQUESTED";
}

function pauseAndRequireSafeResume(): void {
  useMemberBatchStore.getState().markPaused();
}

export function useMemberBatchProcessor({
  shopId,
  warehouseId,
}: UseMemberBatchProcessorInput): void {
  const jobStatus = useMemberBatchStore((state) => state.job?.status);
  const processorActiveRef = useRef(false);
  const mountedRef = useRef(true);

  const processPoints = useCallback(async (item: MemberBatchItem): Promise<void> => {
    const store = useMemberBatchStore.getState();
    if (item.points <= 0) {
      store.updateCurrentItem({
        safeStage: "COMPLETED",
        phase: "IDLE",
        errorMessage: null,
        completedAt: new Date().toISOString(),
      });
      return;
    }
    if (!item.memberUid || !item.memberCode || !warehouseId) {
      throw new Error("Thiếu thông tin thành viên hoặc thẻ để nạp điểm.");
    }

    const operationId = item.pointsOperationId ?? crypto.randomUUID();
    store.updateCurrentItem({
      phase: "TOPPING_UP_POINTS",
      pointsOperationId: operationId,
      errorMessage: null,
    });
    await compensateMemberBalance({
      operationId,
      shopId,
      warehouseId,
      uid: item.memberUid,
      memberCode: item.memberCode,
      memberName: item.fullName,
      storedCategory: 4,
      amount: item.points,
      reason: `Nạp điểm khi đăng ký hàng loạt, dòng ${item.rowNumber}`,
      actionTime: new Date().toISOString(),
    });
    useMemberBatchStore.getState().updateCurrentItem({
      safeStage: "COMPLETED",
      phase: "IDLE",
      errorMessage: null,
      completedAt: new Date().toISOString(),
    });
  }, [shopId, warehouseId]);

  const processCurrent = useCallback(async (): Promise<"COMPLETED" | "STOPPED"> => {
    const store = useMemberBatchStore.getState();
    const job = store.job;
    const item = currentItem();
    if (!job || !item || !warehouseId || job.warehouseId !== warehouseId) return "STOPPED";

    try {
      if (item.safeStage === "CARD_ATTACHED") {
        await processPoints(item);
        return "COMPLETED";
      }

      store.updateCurrentItem({
        phase: "READING_CARD",
        errorMessage: null,
        attempts: item.attempts + 1,
      });
      const prepared = await prepareMemberCardForIssue(
        { shopId, warehouseId },
        (phase) => {
          useMemberBatchStore.getState().updateCurrentItem({
            phase: phase === "WAITING_FOR_NEW_CARD"
              ? "WAITING_FOR_NEW_CARD"
              : phase === "VERIFYING"
                ? "VERIFYING_CARD"
                : "READING_CARD",
          });
        },
        previousAttachedCard(),
      );

      const duplicate = duplicateCard(prepared);
      if (duplicate) {
        throw new Error(
          `Thẻ ${prepared.memberCode} đã được dùng cho dòng ${duplicate.rowNumber} (${duplicate.fullName}).`,
        );
      }
      if (pauseWasRequested() || !mountedRef.current) {
        pauseAndRequireSafeResume();
        return "STOPPED";
      }

      let latestItem = currentItem();
      if (!latestItem) return "STOPPED";
      if (!latestItem.memberUid) {
        store.updateCurrentItem({ phase: "REGISTERING_MEMBER" });
        const registration = await registerMember({
          fullName: latestItem.fullName,
          phone: latestItem.phone,
          memberCode: "",
          gender: latestItem.gender,
          ...birthParts(latestItem.birthDate),
          email: latestItem.email,
          shopId,
          warehouseId,
        });
        useMemberBatchStore.getState().updateCurrentItem({
          safeStage: "MEMBER_CREATED",
          memberUid: registration.member.uid,
          phase: "IDLE",
        });
      }

      if (pauseWasRequested() || !mountedRef.current) {
        pauseAndRequireSafeResume();
        return "STOPPED";
      }

      latestItem = currentItem();
      if (!latestItem?.memberUid) throw new Error("Joyworld không trả UID thành viên vừa tạo.");
      useMemberBatchStore.getState().updateCurrentItem({ phase: "ATTACHING_CARD" });
      const issueInfo = await getMemberCardIssueInfo({
        shopId,
        warehouseId,
        uid: latestItem.memberUid,
        lookupQuery: latestItem.phone,
      });
      await confirmMemberCardIssue({
        shopId,
        warehouseId,
        uid: latestItem.memberUid,
        lookupQuery: latestItem.phone,
        memberAcctId: issueInfo.memberAcctId,
        memberCode: prepared.memberCode,
        memberIcCard: prepared.memberIcCard,
        dynamicSerialNo: prepared.dynamicSerialNo,
      });
      useMemberBatchStore.getState().updateCurrentItem({
        safeStage: "CARD_ATTACHED",
        memberCode: prepared.memberCode,
        cardUuid: prepared.memberIcCard,
        phase: "IDLE",
        errorMessage: null,
      });

      if (pauseWasRequested() || !mountedRef.current) {
        pauseAndRequireSafeResume();
        return "STOPPED";
      }
      latestItem = currentItem();
      if (!latestItem) return "STOPPED";
      await processPoints(latestItem);
      return "COMPLETED";
    } catch (error: unknown) {
      const latestJob = useMemberBatchStore.getState().job;
      useMemberBatchStore.getState().updateCurrentItem({
        phase: "IDLE",
        errorMessage: errorMessage(error),
      });
      if (latestJob?.status === "PAUSE_REQUESTED" || !mountedRef.current) {
        useMemberBatchStore.getState().markPaused();
      } else {
        useMemberBatchStore.getState().markNeedsAttention();
      }
      return "STOPPED";
    }
  }, [processPoints, shopId, warehouseId]);

  const run = useCallback(async (): Promise<void> => {
    if (processorActiveRef.current) return;
    processorActiveRef.current = true;
    try {
      while (mountedRef.current && useMemberBatchStore.getState().job?.status === "RUNNING") {
        const result = await processCurrent();
        if (result !== "COMPLETED") break;
        useMemberBatchStore.getState().advance();
      }
    } finally {
      processorActiveRef.current = false;
      if (useMemberBatchStore.getState().job?.status === "PAUSE_REQUESTED") {
        useMemberBatchStore.getState().markPaused();
      }
    }
  }, [processCurrent]);

  useEffect(() => {
    mountedRef.current = true;
    if (jobStatus === "RUNNING") void run();
    return () => {
      mountedRef.current = false;
    };
  }, [jobStatus, run]);

  useEffect(() => () => {
    const state = useMemberBatchStore.getState();
    if (state.job && ["RUNNING", "PAUSE_REQUESTED"].includes(state.job.status)) {
      state.requestPause();
      state.markPaused();
    }
    void cancelMemberCardRead().catch(() => undefined);
  }, []);
}
