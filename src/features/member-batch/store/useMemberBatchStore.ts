import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { recoveryMessage } from "@/features/member-batch/helpers/memberBatchSafety";
import type {
  ImportedMemberBatchRow,
  MemberBatchItem,
  MemberBatchJob,
} from "@/features/member-batch/types/memberBatch";

interface CreateMemberBatchJobInput {
  fileName: string;
  warehouseId: string;
  warehouseName: string;
  rows: ImportedMemberBatchRow[];
}

interface MemberBatchStore {
  job: MemberBatchJob | null;
  hasHydrated: boolean;
  createJob: (input: CreateMemberBatchJobInput) => void;
  startOrResume: () => void;
  requestPause: () => void;
  markPaused: () => void;
  markNeedsAttention: () => void;
  updateCurrentItem: (patch: Partial<MemberBatchItem>) => void;
  advance: () => void;
  retryCurrent: () => void;
  skipCurrent: () => void;
  recoverInterruptedJob: () => void;
  clearJob: () => void;
  setHasHydrated: (value: boolean) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createItem(row: ImportedMemberBatchRow): MemberBatchItem {
  return {
    ...row,
    id: crypto.randomUUID(),
    safeStage: "AWAITING_CARD",
    phase: "IDLE",
    memberUid: null,
    memberCode: null,
    cardUuid: null,
    pointsOperationId: null,
    errorMessage: null,
    attempts: 0,
    completedAt: null,
  };
}

function withCurrentItem(
  job: MemberBatchJob,
  updater: (item: MemberBatchItem) => MemberBatchItem,
): MemberBatchJob {
  return {
    ...job,
    updatedAt: nowIso(),
    items: job.items.map((item, index) =>
      index === job.currentIndex ? updater(item) : item,
    ),
  };
}

export const useMemberBatchStore = create<MemberBatchStore>()(
  persist(
    (set) => ({
      job: null,
      hasHydrated: false,
      createJob: (input) => set({
        job: {
          schemaVersion: 1,
          id: crypto.randomUUID(),
          fileName: input.fileName,
          warehouseId: input.warehouseId,
          warehouseName: input.warehouseName,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          status: "READY",
          currentIndex: 0,
          items: input.rows.map(createItem),
        },
      }),
      startOrResume: () => set((state) => {
        if (!state.job || state.job.status === "COMPLETED") return state;
        return {
          job: withCurrentItem(
            { ...state.job, status: "RUNNING" },
            (item) => ({ ...item, phase: "IDLE", errorMessage: null }),
          ),
        };
      }),
      requestPause: () => set((state) => {
        if (!state.job) return state;
        if (["READY", "PAUSED", "NEEDS_ATTENTION"].includes(state.job.status)) {
          return { job: { ...state.job, status: "PAUSED", updatedAt: nowIso() } };
        }
        if (state.job.status !== "RUNNING") return state;
        return { job: { ...state.job, status: "PAUSE_REQUESTED", updatedAt: nowIso() } };
      }),
      markPaused: () => set((state) => {
        if (!state.job) return state;
        return {
          job: withCurrentItem(
            { ...state.job, status: "PAUSED" },
            (item) => ({ ...item, phase: "IDLE", errorMessage: recoveryMessage(item) }),
          ),
        };
      }),
      markNeedsAttention: () => set((state) => state.job
        ? { job: { ...state.job, status: "NEEDS_ATTENTION", updatedAt: nowIso() } }
        : state),
      updateCurrentItem: (patch) => set((state) => state.job
        ? { job: withCurrentItem(state.job, (item) => ({ ...item, ...patch })) }
        : state),
      advance: () => set((state) => {
        const job = state.job;
        if (!job) return state;
        const nextIndex = job.items.findIndex(
          (item, index) => index > job.currentIndex &&
            item.safeStage !== "COMPLETED" && item.safeStage !== "SKIPPED",
        );
        const status = nextIndex < 0
          ? "COMPLETED" as const
          : job.status === "PAUSE_REQUESTED"
            ? "PAUSED" as const
            : "RUNNING" as const;
        return {
          job: {
            ...job,
            currentIndex: nextIndex < 0 ? job.currentIndex : nextIndex,
            status,
            updatedAt: nowIso(),
          },
        };
      }),
      retryCurrent: () => set((state) => {
        if (!state.job) return state;
        return {
          job: withCurrentItem(
            { ...state.job, status: "RUNNING" },
            (item) => ({ ...item, phase: "IDLE", errorMessage: null }),
          ),
        };
      }),
      skipCurrent: () => set((state) => {
        if (!state.job) return state;
        const skippedJob = withCurrentItem(state.job, (item) => ({
          ...item,
          safeStage: "SKIPPED",
          phase: "IDLE",
          completedAt: nowIso(),
          errorMessage: item.errorMessage || "Đã bỏ qua theo yêu cầu người vận hành.",
        }));
        const nextIndex = skippedJob.items.findIndex(
          (item, index) => index > skippedJob.currentIndex &&
            item.safeStage !== "COMPLETED" && item.safeStage !== "SKIPPED",
        );
        return {
          job: {
            ...skippedJob,
            currentIndex: nextIndex < 0 ? skippedJob.currentIndex : nextIndex,
            status: nextIndex < 0 ? "COMPLETED" : "PAUSED",
            updatedAt: nowIso(),
          },
        };
      }),
      recoverInterruptedJob: () => set((state) => {
        if (!state.job || !["RUNNING", "PAUSE_REQUESTED"].includes(state.job.status)) {
          return state;
        }
        return {
          job: withCurrentItem(
            { ...state.job, status: "PAUSED" },
            (item) => ({ ...item, phase: "IDLE", errorMessage: recoveryMessage(item) }),
          ),
        };
      }),
      clearJob: () => set({ job: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "jpos-member-batch-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ job: state.job }),
      onRehydrateStorage: () => (state) => {
        state?.recoverInterruptedJob();
        state?.setHasHydrated(true);
      },
    },
  ),
);
