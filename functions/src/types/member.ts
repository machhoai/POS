export type HKNumberish = number | string | null | undefined;

export const MEMBER_BALANCE_CATEGORIES = {
  PRINCIPAL_VND: 101,
  BONUS: 102,
  INTEGRAL: 105,
  LOTTERY: 106,
} as const;

export const MEMBER_ACCOUNT_ATTRIBUTES = {
  PRINCIPAL_VND: 1,
  BONUS: 2,
  INTEGRAL: 5,
  LOTTERY: 6,
} as const;

export type MemberGender = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
export type MemberBalanceBucket =
  | "PRINCIPAL_VND"
  | "BONUS"
  | "INTEGRAL"
  | "LOTTERY"
  | "OTHER";

export interface HKApiResponseDto<TData> {
  success: boolean;
  code: number;
  msg: string;
  data: TData | null;
  desc?: string;
}

export interface HKMemberRegistrationBodyDto {
  openId: string;
  phone: string;
  realName: string;
  password?: string;
}

export interface HKMemberRegistrationDataDto {
  uid?: string | null;
  mid?: string | null;
}

export interface HKMemberProfileUpdateBodyDto {
  uid: string;
  mid?: string;
  realName?: string;
  nickName?: string;
  email?: string;
  sex?: 1 | 2;
  birthday?: string;
}

export interface HKStoredValueDto {
  category?: HKNumberish;
  value?: HKNumberish;
}

export interface HKMemberShopDto {
  shopId?: HKNumberish;
  shopName?: string | null;
  uid?: string | null;
  levelName?: string | null;
  storedValues?: HKStoredValueDto[] | null;
  storedValue?: HKStoredValueDto[] | null;
}

export interface HKMemberLookupDataDto {
  uid?: string | null;
  mid?: string | null;
  memberCode?: string | null;
  phone?: string | null;
  realName?: string | null;
  sex?: string | number | null;
  levelName?: string | null;
  storedValues?: HKStoredValueDto[] | null;
  storedValue?: HKStoredValueDto[] | null;
  items?: HKMemberShopDto[] | null;
}

export interface HKAccountDto {
  key?: string | null;
  id?: string | null;
  shopAcctId?: string | null;
  value?: string | null;
  name?: string | null;
  extendAttr?: HKNumberish;
  unit?: string | null;
}

export interface HKPackageGiveConfigDto {
  shopAcctId?: string | null;
  giveAmount?: HKNumberish;
  effectiveMode?: HKNumberish;
  effectiveDays?: HKNumberish;
}

export interface HKMemberPackageListItemDto {
  goodsId?: string | null;
  goodsName?: string | null;
  category?: HKNumberish;
  price?: HKNumberish;
  remark?: string | null;
  badge?: string | null;
}

export interface HKMemberPackageDetailDto {
  setMealId?: string | null;
  setMealName?: string | null;
  category?: HKNumberish;
  price?: HKNumberish;
  afterTaxPrice?: HKNumberish;
  giveConfigs?: HKPackageGiveConfigDto[] | null;
  exchangeSetts?: unknown[] | null;
}

export interface HKOrderPrecalculationDto {
  totalOriginalMoney?: HKNumberish;
  totalDiscountMoney?: HKNumberish;
  totalMoney?: HKNumberish;
  totalQty?: HKNumberish;
}

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

export interface MemberAccountDefinition {
  accountId: string;
  name: string;
  extendAttr: number;
  unit: string;
  bucket: MemberBalanceBucket;
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
  extraBonusPoints: number | null;
  credits: MemberPackageCredit[];
}

export interface MemberLookupContext {
  shopId?: number;
  memberCode?: string;
}

export interface StoredMemberProfile {
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
