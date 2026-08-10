export type MemberLookupMode = "CARD" | "PHONE";
export type MemberCardLookupKind = "MEMBER_CODE" | "SERIAL_NUMBER";
export type MemberGender = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
export type MemberRegistrationGender = Extract<MemberGender, "MALE" | "FEMALE">;
export type MemberBalanceBucket =
  | "PRINCIPAL_VND"
  | "BONUS"
  | "INTEGRAL"
  | "LOTTERY"
  | "OTHER";

export type RemoteRequestStatus = "IDLE" | "WAITING_API" | "SUCCEEDED" | "FAILED";
export type CardReaderStatus = "IDLE" | "READING" | "SUCCEEDED" | "FAILED";
export type MemberRegistrationReviewStatus =
  | "EDITING"
  | "AWAITING_CUSTOMER"
  | "CUSTOMER_CONFIRMED";
export type MemberMutationKind =
  | "REGISTER"
  | "PACKAGE_TOP_UP"
  | "COMPENSATION_TOP_UP";
export type MemberMutationStatus =
  | "IDLE"
  | "WAITING_PAYMENT"
  | "WAITING_API"
  | "SUCCEEDED"
  | "FAILED";

export interface MemberBalances {
  principalVnd: number;
  bonus: number;
  totalAvailable: number;
  integral: number;
  lottery: number;
  other: Record<string, number>;
}

export interface MemberProfile {
  uid: string;
  mid: string | null;
  memberCode: string | null;
  phone: string;
  fullName: string;
  gender: MemberGender;
  birthDate: string | null;
  email: string | null;
  levelName: string;
  shopId: number | null;
  shopName: string | null;
  balances: MemberBalances;
}

export interface MemberPackageCredit {
  accountId: string;
  accountName: string;
  bucket: MemberBalanceBucket;
  amount: number;
  effectiveMode: number | null;
  effectiveDays: number | null;
}

export interface MemberPointPackage {
  goodsId: string;
  name: string;
  description: string;
  badge: string;
  paymentAmountVnd: number;
  originalAmountVnd: number;
  discountAmountVnd: number;
  priceBeforeTaxVnd: number;
  principalPoints: number;
  bonusBucketPoints: number;
  totalPoints: number;
  /** OpenAPI chưa trả trực tiếp trường thưởng tăng thêm. */
  extraBonusPoints: number | null;
  credits: MemberPackageCredit[];
}

export type MemberStoredValueCategory = 1 | 2 | 5 | 6 | 7;
export type MemberStoredValueCategoryFilter = MemberStoredValueCategory | "ALL";

export interface MemberStoredValueRecord {
  storedCategory: MemberStoredValueCategory;
  createTime: string;
  flowType: 1 | 2;
  businessType: number;
  businessTypeName: string;
  beforeAmount: number;
  amount: number;
  afterAmount: number;
  remark: string;
}

export interface MemberStoredValueHistory {
  page: number;
  limit: number;
  totalPage: number;
  totalRecord: number;
  records: MemberStoredValueRecord[];
  fetchedAt: string;
}

export interface MemberCard {
  category: number;
  memberCode: string;
  icCard: string;
  remark: string;
}

export interface MemberPassTicket {
  passticketId: string;
  name: string;
  category: number;
  activeMode: number;
  buyAmount: number;
  enabledAmount: number;
  buyTime: string;
  startTime: string;
  endTime: string;
}

export interface MemberRegistrationDraft {
  fullName: string;
  phone: string;
  gender: MemberRegistrationGender;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  email: string;
}

export interface MemberCompensationDraft {
  amount: number | null;
  reason: string;
}

export interface MemberCompensationInput {
  operationId: string;
  shopId: number;
  warehouseId: string;
  uid: string;
  memberCode: string | null;
  memberName: string;
  amount: number;
  reason: string;
  actionTime: string;
}

export interface MemberCompensationResult {
  operationId: string;
  totalValue: number | null;
  completedAt: string | null;
  idempotentReplay: boolean;
}

/** Bản ghi do POS sở hữu, chỉ lưu sau khi OpenAPI đăng ký thành công. */
export interface LocalMemberRecord {
  schemaVersion: 1;
  remoteUid: string;
  mid: string | null;
  memberCode: string | null;
  phone: string;
  fullName: string;
  gender: MemberGender;
  birthDate: string | null;
  email: string | null;
  shopId: number;
  warehouseId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  lastRemoteSyncAt: string;
}

export interface RemoteRequestState {
  status: RemoteRequestStatus;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface MemberMutationState {
  kind: MemberMutationKind | null;
  status: MemberMutationStatus;
  remoteOrderNumber: string | null;
  errorCode: string | null;
  failureReason: string | null;
}
