import { MemberInputError } from "./memberPolicy";

const ORDER_ID_PATTERN = /^ORD-\d{10,13}-[A-Z0-9]{6}$/;

export interface MemberPackageCatalogInput {
  shopId: number;
  warehouseId: string;
  uid: string;
}

export interface MemberPackageSaleInput extends MemberPackageCatalogInput {
  localOrderId: string;
  goodsId: string;
}

function record(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new MemberInputError("Dữ liệu bán gói thành viên không hợp lệ.");
  }
  return data as Record<string, unknown>;
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new MemberInputError(`${label} không hợp lệ.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new MemberInputError(`${label} không hợp lệ.`);
  }
  return normalized;
}

export function validateMemberPackageCatalogInput(
  data: unknown,
): MemberPackageCatalogInput {
  const input = record(data);
  if (!Number.isInteger(input.shopId) || Number(input.shopId) <= 0) {
    throw new MemberInputError("Mã cửa hàng không hợp lệ.");
  }
  return {
    shopId: Number(input.shopId),
    warehouseId: requiredString(input.warehouseId, "Điểm bán", 128),
    uid: requiredString(input.uid, "UID thành viên", 128),
  };
}

export function validateMemberPackageSaleInput(
  data: unknown,
): MemberPackageSaleInput {
  const input = record(data);
  const catalog = validateMemberPackageCatalogInput(input);
  const localOrderId = requiredString(input.localOrderId, "Mã đơn hàng", 64);
  if (!ORDER_ID_PATTERN.test(localOrderId)) {
    throw new MemberInputError("Mã đơn hàng không hợp lệ.");
  }
  return {
    ...catalog,
    localOrderId,
    goodsId: requiredString(input.goodsId, "Mã gói thành viên", 128),
  };
}

export function validateMemberPackageOrderId(data: unknown): string {
  const input = record(data);
  const localOrderId = requiredString(input.localOrderId, "Mã đơn hàng", 64);
  if (!ORDER_ID_PATTERN.test(localOrderId)) {
    throw new MemberInputError("Mã đơn hàng không hợp lệ.");
  }
  return localOrderId;
}
