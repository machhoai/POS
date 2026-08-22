import {
  getJoyworldBaseUrl,
  getJoyworldManagerAccessToken,
} from "./joyworldCatalogService";
import { fetchRemoteMemberCards } from "./hkApiService";
import { saveStoredMemberCardIfPresent } from "./memberRepository";
import { assertWarehouseAccess } from "../member/functions";
import {
  validateMemberCardIssueCheckInput,
  validateMemberCardIssueConfirmInput,
  validateMemberCardIssueInfoInput,
} from "../member/memberPolicy";

const REQUEST_TIMEOUT_MS = 30_000;

interface JoyworldResponse {
  success?: boolean;
  code?: unknown;
  msg?: unknown;
  data?: unknown;
}

interface CashierRequest {
  shopId: number;
  path: string;
  method?: "GET" | "POST";
  query?: Record<string, string>;
  body?: unknown;
}

export interface MemberCardIssueInfo {
  memberAcctId: string;
  maxReceiveCard: number;
  takeCardNum: number;
}

export interface MemberCardAvailability {
  dynamicSerialNo: string | null;
}

export interface ConfirmMemberCardIssueResult {
  message: string;
}

export type MemberCardIssueErrorCode =
  | "HK_UNAVAILABLE"
  | "HK_INVALID_RESPONSE"
  | "HK_OPERATION_REJECTED"
  | "HK_MEMBER_NOT_FOUND"
  | "MEMBER_DISABLED"
  | "CARD_LIMIT_REACHED"
  | "CARD_STATE_CHANGED"
  | "LOCAL_PERSISTENCE_FAILED";

export class MemberCardIssueError extends Error {
  constructor(
    readonly code: MemberCardIssueErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MemberCardIssueError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function valueAsString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function valueAsNonNegativeInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function remoteMessage(payload: JoyworldResponse): string {
  return typeof payload.msg === "string" ? payload.msg.trim() : "";
}

async function executeCashierRequest(
  request: CashierRequest,
  token: string,
): Promise<Response> {
  const url = new URL(`${getJoyworldBaseUrl()}${request.path}`);
  for (const [key, value] of Object.entries(request.query ?? {})) {
    url.searchParams.set(key, value);
  }
  return fetch(url, {
    method: request.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "JJ-SHOPID": String(request.shopId),
    },
    body: request.body === undefined
      ? undefined
      : JSON.stringify(request.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function cashierRequest(
  request: CashierRequest,
): Promise<JoyworldResponse> {
  try {
    let token = await getJoyworldManagerAccessToken();
    let response = await executeCashierRequest(request, token);
    if (response.status === 401) {
      token = await getJoyworldManagerAccessToken(true);
      response = await executeCashierRequest(request, token);
    }
    if (!response.ok) {
      throw new MemberCardIssueError(
        "HK_UNAVAILABLE",
        `Hệ thống HK không phản hồi yêu cầu cấp thẻ (HTTP ${response.status}).`,
      );
    }

    const payload = await response.json() as JoyworldResponse;
    if (payload.success !== true) {
      throw new MemberCardIssueError(
        "HK_OPERATION_REJECTED",
        remoteMessage(payload) || "Hệ thống HK từ chối thao tác cấp thẻ.",
      );
    }
    return payload;
  } catch (error: unknown) {
    if (error instanceof MemberCardIssueError) throw error;
    throw new MemberCardIssueError(
      "HK_UNAVAILABLE",
      "Không thể kết nối hệ thống HK. Vui lòng thử lại.",
    );
  }
}

async function resolveMemberAcctId(
  shopId: number,
  lookupQuery: string,
): Promise<string> {
  const response = await cashierRequest({
    shopId,
    path: "/member/cashier/member/getmember/list",
    method: "POST",
    body: { keywords: lookupQuery, isReadCard: false },
  });
  const entries = Array.isArray(response.data) ? response.data : null;
  if (!entries) {
    throw new MemberCardIssueError(
      "HK_INVALID_RESPONSE",
      "HK không trả danh sách tài khoản thành viên hợp lệ.",
    );
  }
  const normalizedLookup = lookupQuery.toLocaleLowerCase("vi-VN");
  const exact = entries.find((entry) => {
    const record = asRecord(entry);
    return [record.phone, record.memberCode]
      .map(valueAsString)
      .some((value) => value?.toLocaleLowerCase("vi-VN") === normalizedLookup);
  });
  const selected = exact ?? (entries.length === 1 ? entries[0] : null);
  const memberAcctId = valueAsString(asRecord(selected).memberAcctId);
  if (!memberAcctId) {
    throw new MemberCardIssueError(
      "HK_MEMBER_NOT_FOUND",
      "Không tìm thấy đúng tài khoản thành viên tại cửa hàng hiện tại.",
    );
  }
  return memberAcctId;
}

async function assertMemberEnabled(
  shopId: number,
  memberAcctId: string,
): Promise<void> {
  const response = await cashierRequest({
    shopId,
    path: "/member/cashier/member/getdetails",
    query: { memberAcctId, isFilterZeroValue: "false" },
  });
  if (asRecord(response.data).isEnabled !== true) {
    throw new MemberCardIssueError(
      "MEMBER_DISABLED",
      "Tài khoản thành viên đang bị vô hiệu hóa trên HK nên không thể cấp thêm thẻ.",
    );
  }
}

async function loadIssueInfo(
  shopId: number,
  memberAcctId: string,
): Promise<MemberCardIssueInfo> {
  const response = await cashierRequest({
    shopId,
    path: "/member/cashier/membercard/take/info",
    query: { memberAcctId },
  });
  const data = asRecord(response.data);
  const maxReceiveCard = valueAsNonNegativeInteger(data.maxReceiveCard);
  const takeCardNum = valueAsNonNegativeInteger(data.takeCardNum);
  if (maxReceiveCard === null || takeCardNum === null) {
    throw new MemberCardIssueError(
      "HK_INVALID_RESPONSE",
      "HK không trả giới hạn cấp thẻ hợp lệ.",
    );
  }
  return {
    memberAcctId,
    maxReceiveCard,
    takeCardNum,
  };
}

async function checkCard(
  shopId: number,
  memberCode: string,
): Promise<MemberCardAvailability> {
  const response = await cashierRequest({
    shopId,
    path: "/member/cashier/membercard/take/check",
    query: { memberCode },
  });
  const dynamicSerialNo = valueAsString(response.data);
  return { dynamicSerialNo };
}

async function isCardAlreadyAttached(
  uid: string,
  memberCode: string,
): Promise<boolean> {
  try {
    const response = await fetchRemoteMemberCards(uid);
    return response.success && Array.isArray(response.data) && response.data.some(
      (card) => valueAsString(card.memberCode) === memberCode,
    );
  } catch {
    return false;
  }
}

async function persistConfirmedCard(params: {
  uid: string;
  memberCode: string;
  userId: string;
}): Promise<void> {
  try {
    await saveStoredMemberCardIfPresent({
      remoteUid: params.uid,
      memberCode: params.memberCode,
      updatedBy: params.userId,
      lastRemoteSyncAt: new Date().toISOString(),
    });
  } catch {
    throw new MemberCardIssueError(
      "LOCAL_PERSISTENCE_FAILED",
      "Joyworld đã gắn thẻ nhưng POS chưa lưu được mã thẻ local. " +
      "Có thể thử lại an toàn để đồng bộ hồ sơ.",
    );
  }
}

export async function getMemberCardIssueInfoForUser(
  userId: string,
  data: unknown,
): Promise<MemberCardIssueInfo> {
  const input = validateMemberCardIssueInfoInput(data);
  await assertWarehouseAccess(userId, input.warehouseId);
  const memberAcctId = await resolveMemberAcctId(input.shopId, input.lookupQuery);
  await assertMemberEnabled(input.shopId, memberAcctId);
  return loadIssueInfo(input.shopId, memberAcctId);
}

export async function checkMemberCardForIssueForUser(
  userId: string,
  data: unknown,
): Promise<MemberCardAvailability> {
  const input = validateMemberCardIssueCheckInput(data);
  await assertWarehouseAccess(userId, input.warehouseId);
  return checkCard(input.shopId, input.memberCode);
}

export async function confirmMemberCardIssueForUser(
  userId: string,
  data: unknown,
): Promise<ConfirmMemberCardIssueResult> {
  const input = validateMemberCardIssueConfirmInput(data);
  await assertWarehouseAccess(userId, input.warehouseId);

  const resolvedMemberAcctId = await resolveMemberAcctId(
    input.shopId,
    input.lookupQuery,
  );
  if (resolvedMemberAcctId !== input.memberAcctId) {
    throw new MemberCardIssueError(
      "CARD_STATE_CHANGED",
      "Tài khoản thành viên đã thay đổi trong lúc xử lý. Vui lòng kiểm tra lại.",
    );
  }
  await assertMemberEnabled(input.shopId, resolvedMemberAcctId);

  if (await isCardAlreadyAttached(input.uid, input.memberCode)) {
    await persistConfirmedCard({
      uid: input.uid,
      memberCode: input.memberCode,
      userId,
    });
    return {
      message: "Thẻ đã được gắn trên Joyworld và đã đồng bộ vào POS.",
    };
  }

  const issueInfo = await loadIssueInfo(input.shopId, resolvedMemberAcctId);
  if (
    issueInfo.maxReceiveCard > 0 &&
    issueInfo.takeCardNum >= issueInfo.maxReceiveCard
  ) {
    throw new MemberCardIssueError(
      "CARD_LIMIT_REACHED",
      `Thành viên đã đạt giới hạn ${issueInfo.maxReceiveCard} thẻ do HK cấu hình.`,
    );
  }

  const latestCheck = await checkCard(input.shopId, input.memberCode);
  if (latestCheck.dynamicSerialNo !== input.dynamicSerialNo) {
    throw new MemberCardIssueError(
      "CARD_STATE_CHANGED",
      "Trạng thái thẻ đã thay đổi trong lúc xử lý. Vui lòng đọc lại thẻ.",
    );
  }

  const response = await cashierRequest({
    shopId: input.shopId,
    path: "/member/cashier/membercard/take/confirm",
    method: "POST",
    body: {
      memberAcctId: resolvedMemberAcctId,
      cardInfoList: [{
        memberICCard: input.memberIcCard,
        memberCode: input.memberCode,
        ...(input.dynamicSerialNo
          ? { dynamicSerialNo: input.dynamicSerialNo }
          : {}),
      }],
    },
  });
  await persistConfirmedCard({
    uid: input.uid,
    memberCode: input.memberCode,
    userId,
  });
  return {
    message: remoteMessage(response) || "Đã cấp thêm thẻ thành viên thành công.",
  };
}
