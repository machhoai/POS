import { HttpsError } from "firebase-functions/v2/https";

import { POS_COLLECTIONS } from "../config/collections";
import { db } from "../config/firebase";
import type {
  PosVoucherResolution,
  PosVoucherRewardType,
} from "../types/voucher";
import { isProductAvailableForWarehouse } from "./productVisibilityPolicy";

export const VOUCHER_CAMPAIGNS_COLLECTION = "marketing_voucher_campaigns";
export const VOUCHER_CODES_COLLECTION = "marketing_voucher_codes";
export const VOUCHER_SETTINGS_COLLECTION = "pos_voucher_campaign_settings";
export const VOUCHER_REDEMPTIONS_COLLECTION = "pos_voucher_redemptions";
const SUPPORTED_REWARDS = new Set<PosVoucherRewardType>([
  "DISCOUNT_PERCENT",
  "FREE_TICKET",
  "FREE_ITEM",
]);

export interface RawVoucherCode {
  campaign_id?: unknown;
  campaign_name?: unknown;
  reward_type?: unknown;
  reward_value?: unknown;
  status?: unknown;
  valid_to?: unknown;
  is_deleted?: unknown;
}

export const voucherText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const normalizeVoucherCode = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Mã voucher không hợp lệ.");
  }
  const code = value.trim().normalize("NFKC").toUpperCase();
  if (!/^[A-Z0-9-]{4,80}$/u.test(code)) {
    throw new HttpsError("invalid-argument", "Mã voucher không hợp lệ.");
  }
  return code;
};

const businessDate = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export const buildVoucherSettingId = (
  warehouseId: string,
  campaignId: string,
): string => `${warehouseId}__${campaignId}`;

const assertVoucherUsable = (
  code: RawVoucherCode,
  campaign: Record<string, unknown>,
): PosVoucherRewardType => {
  if (
    code.is_deleted === true ||
    !["AVAILABLE", "DISTRIBUTED"].includes(voucherText(code.status))
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Voucher đã được sử dụng hoặc không còn hiệu lực.",
    );
  }
  if (campaign.is_deleted === true || campaign.status !== "ACTIVE") {
    throw new HttpsError("failed-precondition", "Chiến dịch voucher hiện không hoạt động.");
  }
  const today = businessDate();
  if (voucherText(campaign.valid_from) > today || voucherText(campaign.valid_to) < today) {
    throw new HttpsError("failed-precondition", "Voucher chưa đến hạn hoặc đã hết hạn.");
  }
  const rewardType = voucherText(code.reward_type) as PosVoucherRewardType;
  if (!SUPPORTED_REWARDS.has(rewardType)) {
    throw new HttpsError("failed-precondition", "Loại voucher chưa được JPOS hỗ trợ.");
  }
  return rewardType;
};

export const buildVoucherResolution = (
  codeValue: string,
  code: RawVoucherCode,
  campaignId: string,
  campaign: Record<string, unknown>,
  setting: Record<string, unknown>,
  product: Record<string, unknown>,
): PosVoucherResolution => {
  const rewardType = assertVoucherUsable(code, campaign);
  if (setting.is_deleted === true || setting.enabled !== true) {
    throw new HttpsError("failed-precondition", "Voucher không được áp dụng tại cửa hàng này.");
  }
  const priceCandidate = Number(product.afterTaxPrice);
  const fallbackPrice = Number(product.price);
  const price = Number.isFinite(priceCandidate) && priceCandidate >= 0
    ? priceCandidate
    : fallbackPrice;
  const quantity = Number(setting.quantity);
  const rewardValue = Number(code.reward_value) || Number(campaign.reward_value) || 0;
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) {
    throw new HttpsError("failed-precondition", "Mapping sản phẩm của voucher không hợp lệ.");
  }
  if (
    rewardType === "DISCOUNT_PERCENT" &&
    (!Number.isFinite(rewardValue) || rewardValue <= 0 || rewardValue > 100)
  ) {
    throw new HttpsError("failed-precondition", "Phần trăm giảm giá của voucher không hợp lệ.");
  }
  return {
    code: codeValue,
    campaignId,
    campaignName: voucherText(campaign.name) || voucherText(code.campaign_name) || campaignId,
    rewardType,
    rewardValue,
    product: {
      goodsId: voucherText(setting.product_id),
      goodsName: voucherText(product.goodsName) || voucherText(product.name) || voucherText(setting.product_id),
      price,
      quantity,
      ...(Number(product.ticketsPerUnit) > 0
        ? { ticketsPerUnit: Number(product.ticketsPerUnit) }
        : {}),
    },
  };
};

export async function resolveVoucherForCart(
  voucherCode: unknown,
  warehouseId: string,
): Promise<PosVoucherResolution> {
  const codeValue = normalizeVoucherCode(voucherCode);
  const codeSnapshot = await db.collection(VOUCHER_CODES_COLLECTION).doc(codeValue).get();
  if (!codeSnapshot.exists) throw new HttpsError("not-found", "Không tìm thấy voucher.");
  const code = codeSnapshot.data() as RawVoucherCode;
  const campaignId = voucherText(code.campaign_id);
  if (!campaignId) {
    throw new HttpsError(
      "failed-precondition",
      "Voucher chưa được liên kết với chiến dịch hợp lệ.",
    );
  }
  const [campaignSnapshot, settingSnapshot, visibilitySnapshot] = await Promise.all([
    db.collection(VOUCHER_CAMPAIGNS_COLLECTION).doc(campaignId).get(),
    db.collection(VOUCHER_SETTINGS_COLLECTION)
      .doc(buildVoucherSettingId(warehouseId, campaignId)).get(),
    db.collection(POS_COLLECTIONS.productVisibilitySettings).doc(warehouseId).get(),
  ]);
  if (!campaignSnapshot.exists || !settingSnapshot.exists) {
    throw new HttpsError("failed-precondition", "Voucher chưa được cấu hình cho cửa hàng này.");
  }
  const setting = settingSnapshot.data() || {};
  const productId = voucherText(setting.product_id);
  if (!productId) {
    throw new HttpsError(
      "failed-precondition",
      "Voucher chưa được mapping với sản phẩm tại cửa hàng này.",
    );
  }
  const productSnapshot = await db.collection(POS_COLLECTIONS.products).doc(productId).get();
  const product = productSnapshot.data();
  if (!productSnapshot.exists || !product ||
      !isProductAvailableForWarehouse(productId, product, visibilitySnapshot.data())) {
    throw new HttpsError("failed-precondition", "Sản phẩm của voucher hiện không được bán tại cửa hàng.");
  }
  return buildVoucherResolution(
    codeValue,
    code,
    campaignId,
    campaignSnapshot.data() || {},
    setting,
    product,
  );
}
