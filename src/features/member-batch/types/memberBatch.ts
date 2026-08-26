import type { MemberRegistrationGender } from "@/lib/types/member";

export interface ImportedMemberBatchRow {
  rowNumber: number;
  fullName: string;
  phone: string;
  gender: MemberRegistrationGender;
  birthDate: string | null;
  email: string;
  points: number;
}

export interface MemberBatchImportError {
  rowNumber: number | null;
  message: string;
}

export type MemberBatchSafeStage =
  | "AWAITING_CARD"
  | "MEMBER_CREATED"
  | "CARD_ATTACHED"
  | "COMPLETED"
  | "SKIPPED";

export type MemberBatchPhase =
  | "IDLE"
  | "WAITING_FOR_NEW_CARD"
  | "READING_CARD"
  | "VERIFYING_CARD"
  | "REGISTERING_MEMBER"
  | "ATTACHING_CARD"
  | "TOPPING_UP_POINTS";

export interface MemberBatchItem extends ImportedMemberBatchRow {
  id: string;
  safeStage: MemberBatchSafeStage;
  phase: MemberBatchPhase;
  memberUid: string | null;
  memberCode: string | null;
  cardUuid: string | null;
  pointsOperationId: string | null;
  errorMessage: string | null;
  attempts: number;
  completedAt: string | null;
}

export type MemberBatchJobStatus =
  | "READY"
  | "RUNNING"
  | "PAUSE_REQUESTED"
  | "PAUSED"
  | "NEEDS_ATTENTION"
  | "COMPLETED";

export interface MemberBatchJob {
  schemaVersion: 1;
  id: string;
  fileName: string;
  warehouseId: string;
  warehouseName: string;
  createdAt: string;
  updatedAt: string;
  status: MemberBatchJobStatus;
  currentIndex: number;
  items: MemberBatchItem[];
}

export interface MemberBatchImportResult {
  rows: ImportedMemberBatchRow[];
  errors: MemberBatchImportError[];
}

