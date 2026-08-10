import { HttpsError } from "firebase-functions/v2/https";
import { POS_COLLECTIONS } from "../config/collections";
import { db } from "../config/firebase";
import { compensateRemoteMemberBalance } from "../services/hkApiService";
import { getPosAuthSession } from "../services/posAuthService";
import type {
  MemberCompensationRecord,
  MemberCompensationStatus,
} from "../types/member";
import { MemberRemoteApiError } from "./functions";
import {
  type MemberCompensationInput,
  validateMemberCompensationInput,
} from "./memberPolicy";

const PROCESSING_STALE_AFTER_MS = 2 * 60 * 1000;

function hasScopedPermission(
  permissions: Record<string, Record<string, unknown>>,
  permission: string,
  warehouseId: string,
): boolean {
  return permissions.global?.["*"] === true ||
    permissions.global?.[permission] === true ||
    permissions[warehouseId]?.["*"] === true ||
    permissions[warehouseId]?.[permission] === true;
}

function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toMillis" in value) {
    const toMillis = (value as { toMillis?: unknown }).toMillis;
    if (typeof toMillis === "function") {
      return Number(toMillis.call(value));
    }
  }
  return 0;
}

function timestampIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const date = toDate.call(value);
      return date instanceof Date ? date.toISOString() : null;
    }
  }
  return null;
}

function sameOperation(
  record: MemberCompensationRecord,
  input: MemberCompensationInput,
  userId: string,
  deviceId: string,
): boolean {
  return record.warehouse_id === input.warehouseId &&
    record.shop_id === input.shopId &&
    record.member_uid === input.uid &&
    record.amount === input.amount &&
    record.reason === input.reason &&
    record.created_by === userId &&
    record.device_id === deviceId;
}

function remoteMessage(
  response: { msg?: string; desc?: string },
  fallback: string,
): string {
  return response.msg?.trim() || response.desc?.trim() || fallback;
}

function remoteTotalValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function beginCompensation(params: {
  input: MemberCompensationInput;
  userId: string;
  userName: string;
  deviceId: string;
}): Promise<{ record: MemberCompensationRecord; alreadySucceeded: boolean }> {
  const ref = db.collection(POS_COLLECTIONS.memberCompensations)
    .doc(params.input.operationId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const now = new Date();
    if (!snapshot.exists) {
      const record: MemberCompensationRecord = {
        id: params.input.operationId,
        warehouse_id: params.input.warehouseId,
        shop_id: params.input.shopId,
        member_uid: params.input.uid,
        member_code: params.input.memberCode,
        member_name: params.input.memberName,
        stored_category: 1,
        amount: params.input.amount,
        reason: params.input.reason,
        accounting_category: 1004,
        status: "PROCESSING",
        created_by: params.userId,
        created_by_name: params.userName,
        device_id: params.deviceId,
        action_time: new Date(params.input.actionTime),
        sync_time: now,
        attempt_count: 1,
        remote_total_value: null,
        remote_code: null,
        remote_message: null,
        completed_at: null,
        is_deleted: false,
        created_at: now,
        updated_at: now,
      };
      transaction.create(ref, record);
      return { record, alreadySucceeded: false };
    }

    const existing = snapshot.data() as MemberCompensationRecord;
    if (!sameOperation(existing, params.input, params.userId, params.deviceId)) {
      throw new HttpsError(
        "failed-precondition",
        "Mã thao tác đã được dùng cho một yêu cầu nạp bù khác.",
      );
    }
    if (existing.status === "SUCCEEDED") {
      return { record: existing, alreadySucceeded: true };
    }
    if (
      existing.status === "PROCESSING" &&
      Date.now() - timestampMillis(existing.updated_at) < PROCESSING_STALE_AFTER_MS
    ) {
      throw new HttpsError(
        "aborted",
        "Yêu cầu nạp bù đang được xử lý. Vui lòng chờ trước khi thử lại.",
      );
    }

    const record: MemberCompensationRecord = {
      ...existing,
      status: "PROCESSING",
      attempt_count: existing.attempt_count + 1,
      remote_code: null,
      remote_message: null,
      sync_time: now,
      updated_at: now,
    };
    transaction.update(ref, {
      status: record.status,
      attempt_count: record.attempt_count,
      remote_code: null,
      remote_message: null,
      sync_time: now,
      updated_at: now,
    });
    return { record, alreadySucceeded: false };
  });
}

async function finishCompensation(params: {
  record: MemberCompensationRecord;
  status: Exclude<MemberCompensationStatus, "PROCESSING">;
  remoteCode: number | null;
  remoteMessage: string;
  remoteTotalValue: number | null;
}): Promise<MemberCompensationRecord> {
  const ref = db.collection(POS_COLLECTIONS.memberCompensations)
    .doc(params.record.id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data() as MemberCompensationRecord | undefined;
    if (
      !current ||
      current.status !== "PROCESSING" ||
      current.attempt_count !== params.record.attempt_count
    ) {
      throw new HttpsError(
        "aborted",
        "Trạng thái nạp bù đã thay đổi. Vui lòng tải lại thành viên.",
      );
    }
    const now = new Date();
    const completedAt = params.status === "SUCCEEDED" ? now : null;
    const next: MemberCompensationRecord = {
      ...current,
      status: params.status,
      remote_code: params.remoteCode,
      remote_message: params.remoteMessage,
      remote_total_value: params.remoteTotalValue,
      completed_at: completedAt,
      sync_time: now,
      updated_at: now,
    };
    transaction.update(ref, {
      status: next.status,
      remote_code: next.remote_code,
      remote_message: next.remote_message,
      remote_total_value: next.remote_total_value,
      completed_at: next.completed_at,
      sync_time: now,
      updated_at: now,
    });
    const auditId = `${next.id}-${next.attempt_count}-${next.status.toLowerCase()}`;
    transaction.create(db.collection("audit_logs").doc(auditId), {
      id: auditId,
      entity_type: "POS_MEMBER_COMPENSATION",
      entity_id: next.id,
      entity_name: next.member_name,
      warehouse_id: next.warehouse_id,
      action: next.status === "SUCCEEDED" ? "CREATE" : "UPDATE",
      user_id: next.created_by,
      user_name: next.created_by_name,
      action_time: next.action_time,
      sync_time: now,
      old_value: { status: "PROCESSING" },
      new_value: {
        status: next.status,
        member_uid: next.member_uid,
        member_code: next.member_code,
        amount: next.amount,
        reason: next.reason,
        remote_total_value: next.remote_total_value,
        remote_code: next.remote_code,
      },
      ip_address: null,
      device_id: next.device_id,
      session_token: null,
      notes: next.remote_message,
    });
    return next;
  });
}

export async function compensatePosMemberForUser(
  userId: string,
  data: unknown,
  deviceId: string,
) {
  const input = validateMemberCompensationInput(data);
  const session = await getPosAuthSession(userId, input.warehouseId);
  if (
    !session.warehouses.some((warehouse) => warehouse.id === input.warehouseId) ||
    !hasScopedPermission(
      session.permissions,
      "pos.members.compensate",
      input.warehouseId,
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền nạp bù tài khoản thành viên tại điểm bán này.",
    );
  }

  const started = await beginCompensation({
    input,
    userId,
    userName: session.user.full_name,
    deviceId,
  });
  if (started.alreadySucceeded) {
    return {
      operationId: started.record.id,
      totalValue: started.record.remote_total_value,
      completedAt: timestampIso(started.record.completed_at),
      idempotentReplay: true,
    };
  }

  let response;
  try {
    response = await compensateRemoteMemberBalance({
      uid: input.uid,
      operationId: input.operationId,
      amount: input.amount,
      remark: `Nạp bù thẻ: ${input.reason}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không rõ nguyên nhân";
    await finishCompensation({
      record: started.record,
      status: "UNKNOWN",
      remoteCode: null,
      remoteMessage: message,
      remoteTotalValue: null,
    });
    throw new MemberRemoteApiError(
      "member_addstored",
      null,
      `Mất kết nối khi nạp bù. Có thể thử lại an toàn với cùng mã thao tác: ${message}`,
    );
  }

  if (!response.success) {
    const message = remoteMessage(response, "OpenAPI từ chối yêu cầu nạp bù.");
    await finishCompensation({
      record: started.record,
      status: "FAILED",
      remoteCode: response.code,
      remoteMessage: message,
      remoteTotalValue: null,
    });
    throw new MemberRemoteApiError("member_addstored", response.code, message);
  }

  const finished = await finishCompensation({
    record: started.record,
    status: "SUCCEEDED",
    remoteCode: response.code,
    remoteMessage: remoteMessage(response, "Nạp bù thành công."),
    remoteTotalValue: remoteTotalValue(response.data?.totalValue),
  });
  return {
    operationId: finished.id,
    totalValue: finished.remote_total_value,
    completedAt: finished.completed_at?.toISOString() ?? new Date().toISOString(),
    idempotentReplay: false,
  };
}
