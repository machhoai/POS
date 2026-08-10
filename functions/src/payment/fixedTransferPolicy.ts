import type { FixedTransferSettingsInput } from "../types/paymentSettings";

const BANK_BIN_PATTERN = /^\d{6}$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{6,19}$/;

export function normalizeFixedTransferSettings(
  input: FixedTransferSettingsInput,
): FixedTransferSettingsInput {
  const normalized = {
    warehouseId: input.warehouseId.trim(),
    enabled: input.enabled === true,
    bankBin: input.bankBin.replace(/\s+/g, ""),
    accountNumber: input.accountNumber.replace(/\s+/g, ""),
    accountName: input.accountName.trim().replace(/\s+/g, " "),
  };

  if (!normalized.warehouseId) throw new Error("Điểm bán không hợp lệ.");
  if (!BANK_BIN_PATTERN.test(normalized.bankBin)) {
    throw new Error("Mã BIN ngân hàng phải gồm đúng 6 chữ số.");
  }
  if (!ACCOUNT_NUMBER_PATTERN.test(normalized.accountNumber)) {
    throw new Error("Số tài khoản phải gồm từ 6 đến 19 chữ số.");
  }
  if (
    normalized.accountName.length < 5 ||
    normalized.accountName.length > 50
  ) {
    throw new Error("Tên tài khoản phải có từ 5 đến 50 ký tự.");
  }

  return normalized;
}

export function buildVietQrQuickLink(input: {
  bankBin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
}): string {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new Error("Số tiền tạo VietQR phải là số nguyên dương.");
  }
  const path = `${input.bankBin}-${input.accountNumber}-compact2.png`;
  const query = new URLSearchParams({
    amount: String(input.amount),
    addInfo: input.description,
    accountName: input.accountName,
  });
  return `https://img.vietqr.io/image/${path}?${query.toString()}`;
}
