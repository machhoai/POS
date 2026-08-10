import { HttpsError } from "firebase-functions/v2/https";
import type { HKApiResponse } from "../services/hkApiService";
import {
  fetchRemoteMemberByCard,
  fetchRemoteMemberByPhone,
  registerRemoteMember,
  updateRemoteMemberProfile,
} from "../services/hkApiService";
import { mapMemberLookup, MemberMappingError } from "../services/memberMapper";
import {
  getStoredMemberProfile,
  saveStoredMemberProfile,
} from "../services/memberRepository";
import { getPosAuthSession } from "../services/posAuthService";
import type {
  HKMemberLookupDataDto,
  MemberBalances,
  MemberProfile,
  StoredMemberProfile,
} from "../types/member";
import {
  createMemberOpenId,
  type MemberLookupInput,
  type MemberProfileUpdateInput,
  type MemberRegistrationInput,
  toRemoteSex,
  validateMemberLookupInput,
  validateMemberProfileUpdateInput,
  validateMemberRegistrationInput,
} from "./memberPolicy";

const EMPTY_BALANCES: MemberBalances = {
  principalVnd: 0,
  bonus: 0,
  totalAvailable: 0,
  integral: 0,
  lottery: 0,
  other: {},
};

export class MemberRemoteApiError extends Error {
  constructor(
    readonly action: string,
    readonly remoteCode: number | null,
    message: string,
    readonly isNotFound = false,
  ) {
    super(message);
    this.name = "MemberRemoteApiError";
  }
}

export class MemberLocalPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberLocalPersistenceError";
  }
}

async function assertWarehouseAccess(
  userId: string,
  warehouseId: string,
): Promise<void> {
  const session = await getPosAuthSession(userId);
  if (!session.warehouses.some((warehouse) => warehouse.id === warehouseId)) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền thao tác thành viên tại điểm bán này.",
    );
  }
}

function remoteReason<TData>(
  response: HKApiResponse<TData>,
  fallback: string,
): string {
  return response.msg?.trim() || response.desc?.trim() || fallback;
}

async function callRemote<TData>(
  action: string,
  request: () => Promise<HKApiResponse<TData>>,
): Promise<HKApiResponse<TData>> {
  try {
    return await request();
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "Không rõ nguyên nhân";
    throw new MemberRemoteApiError(
      action,
      null,
      `Không thể kết nối OpenAPI: ${reason}`,
    );
  }
}

function mergeLocalProfile(
  remote: MemberProfile,
  local: StoredMemberProfile | null,
): MemberProfile {
  if (!local) return remote;
  return {
    ...remote,
    mid: remote.mid ?? local.mid,
    memberCode: remote.memberCode ?? local.memberCode,
    phone: remote.phone || local.phone,
    fullName: remote.fullName || local.fullName,
    gender: remote.gender === "UNKNOWN" ? local.gender : remote.gender,
    birthDate: local.birthDate,
    email: local.email,
  };
}

async function fetchAndMapMember(input: MemberLookupInput): Promise<MemberProfile> {
  const isPhone = input.mode === "PHONE";
  const action = isPhone
    ? "member_getmember_phone"
    : "member_getmember_membercode";
  const response = await callRemote<HKMemberLookupDataDto>(
    action,
    () => isPhone
      ? fetchRemoteMemberByPhone({ shopId: input.shopId, phone: input.query })
      : fetchRemoteMemberByCard(input.query),
  );

  if (!response.success || !response.data) {
    throw new MemberRemoteApiError(
      action,
      response.code,
      remoteReason(response, "Không tìm thấy thành viên."),
      true,
    );
  }

  try {
    return mapMemberLookup(response.data, {
      shopId: input.shopId,
      memberCode: isPhone ? undefined : input.query,
    });
  } catch (error: unknown) {
    if (error instanceof MemberMappingError) throw error;
    throw new MemberMappingError("Không thể đọc response thành viên từ OpenAPI.");
  }
}

export async function lookupPosMemberForUser(
  userId: string,
  data: unknown,
) {
  const input = validateMemberLookupInput(data);
  await assertWarehouseAccess(userId, input.warehouseId);
  const remoteMember = await fetchAndMapMember(input);
  const localMember = await getStoredMemberProfile(remoteMember.uid);

  return {
    member: mergeLocalProfile(remoteMember, localMember),
    fetchedAt: new Date().toISOString(),
  };
}

function registrationProfile(
  input: MemberRegistrationInput,
  remoteUid: string,
  mid: string | null,
): MemberProfile {
  return {
    uid: remoteUid,
    mid,
    memberCode: null,
    phone: input.phone,
    fullName: input.fullName,
    gender: input.gender,
    birthDate: input.birthDate,
    email: input.email,
    levelName: "",
    shopId: input.shopId,
    shopName: null,
    balances: EMPTY_BALANCES,
  };
}

async function persistProfileAfterRemoteSuccess(params: {
  input: MemberRegistrationInput;
  userId: string;
  remoteUid: string;
  mid: string | null;
  memberCode: string | null;
}): Promise<StoredMemberProfile> {
  const remoteSyncAt = new Date().toISOString();
  try {
    return await saveStoredMemberProfile({
      remoteUid: params.remoteUid,
      mid: params.mid,
      memberCode: params.memberCode,
      phone: params.input.phone,
      fullName: params.input.fullName,
      gender: params.input.gender,
      birthDate: params.input.birthDate,
      email: params.input.email,
      shopId: params.input.shopId,
      warehouseId: params.input.warehouseId,
      createdBy: params.userId,
      updatedBy: params.userId,
      lastRemoteSyncAt: remoteSyncAt,
    });
  } catch {
    throw new MemberLocalPersistenceError(
      "OpenAPI đã xử lý thành công nhưng POS không thể lưu hồ sơ local. " +
      "Vui lòng liên hệ quản trị viên trước khi thử lại.",
    );
  }
}

export async function registerPosMemberForUser(
  userId: string,
  data: unknown,
) {
  const input = validateMemberRegistrationInput(data);
  await assertWarehouseAccess(userId, input.warehouseId);
  const response = await callRemote(
    "member_join",
    () => registerRemoteMember({
      openId: createMemberOpenId(input.phone),
      phone: input.phone,
      realName: input.fullName,
    }),
  );
  const remoteUid = response.data?.uid?.trim() || "";

  if (!response.success || !remoteUid) {
    throw new MemberRemoteApiError(
      "member_join",
      response.code,
      remoteReason(response, "OpenAPI không thể đăng ký thành viên."),
    );
  }

  const mid = response.data?.mid?.trim() || null;
  const stored = await persistProfileAfterRemoteSuccess({
    input,
    userId,
    remoteUid,
    mid,
    memberCode: null,
  });

  return {
    member: registrationProfile(input, remoteUid, mid),
    remoteMessage: response.msg || null,
    createdAt: stored.createdAt,
  };
}

function updateInputAsRegistration(
  input: MemberProfileUpdateInput,
): MemberRegistrationInput {
  return {
    shopId: input.shopId,
    warehouseId: input.warehouseId,
    fullName: input.fullName,
    phone: input.phone,
    gender: input.gender,
    birthDate: input.birthDate,
    email: input.email,
  };
}

export async function updatePosMemberProfileForUser(
  userId: string,
  data: unknown,
) {
  const input = validateMemberProfileUpdateInput(data);
  await assertWarehouseAccess(userId, input.warehouseId);
  const sex = toRemoteSex(input.gender);
  const response = await callRemote(
    "member_info_modify",
    () => updateRemoteMemberProfile({
      uid: input.uid,
      ...(input.mid ? { mid: input.mid } : {}),
      realName: input.fullName,
      nickName: input.fullName,
      email: input.email ?? "",
      birthday: input.birthDate ?? "",
      ...(sex ? { sex } : {}),
    }),
  );

  if (!response.success || response.data !== true) {
    throw new MemberRemoteApiError(
      "member_info_modify",
      response.code,
      remoteReason(response, "OpenAPI không thể cập nhật hồ sơ thành viên."),
    );
  }

  const existing = await getStoredMemberProfile(input.uid);
  const stored = await persistProfileAfterRemoteSuccess({
    input: updateInputAsRegistration(input),
    userId,
    remoteUid: input.uid,
    mid: input.mid ?? existing?.mid ?? null,
    memberCode: input.memberCode ?? existing?.memberCode ?? null,
  });

  return {
    profile: stored,
    remoteMessage: response.msg || null,
    updatedAt: stored.updatedAt,
  };
}
