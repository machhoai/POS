import { HttpsError } from "firebase-functions/v2/https";

import type { OrderItem } from "../types/order";
import type {
  PosOrderVoucherSnapshot,
  PosVoucherResolution,
} from "../types/voucher";

export interface VoucherCalculation {
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  vouchers: PosOrderVoucherSnapshot[];
}

export const calculateVoucherDiscount = (
  items: OrderItem[],
  resolutions: PosVoucherResolution[],
): VoucherCalculation => {
  const subtotalAmount = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const requiredFreeQuantity = new Map<string, number>();
  let freeDiscount = 0;
  let percentVoucher: PosVoucherResolution | null = null;
  for (const resolution of resolutions) {
    const item = items.find((candidate) =>
      candidate.goodsId === resolution.product.goodsId,
    );
    if (!item || item.quantity < resolution.product.quantity) {
      throw new HttpsError(
        "failed-precondition",
        `Đơn hàng chưa có đủ sản phẩm cho voucher ${resolution.code}.`,
      );
    }
    if (resolution.rewardType === "DISCOUNT_PERCENT") {
      if (percentVoucher) {
        throw new HttpsError(
          "failed-precondition",
          "Mỗi đơn chỉ được dùng một voucher giảm phần trăm.",
        );
      }
      percentVoucher = resolution;
      continue;
    }
    const nextRequired =
      (requiredFreeQuantity.get(item.goodsId) ?? 0) + resolution.product.quantity;
    if (nextRequired > item.quantity) {
      throw new HttpsError(
        "failed-precondition",
        `Số lượng ${item.goodsName} không đủ cho các voucher đã quét.`,
      );
    }
    requiredFreeQuantity.set(item.goodsId, nextRequired);
    freeDiscount += item.price * resolution.product.quantity;
  }
  const percentDiscount = percentVoucher
    ? Math.round((subtotalAmount - freeDiscount) * percentVoucher.rewardValue / 100)
    : 0;
  const discountAmount = Math.min(subtotalAmount, freeDiscount + percentDiscount);
  const vouchers = resolutions.map((resolution) => ({
    ...resolution,
    discountAmount: resolution.rewardType === "DISCOUNT_PERCENT"
      ? percentDiscount
      : items.find((item) => item.goodsId === resolution.product.goodsId)!.price *
        resolution.product.quantity,
  }));
  return {
    subtotalAmount,
    discountAmount,
    totalAmount: subtotalAmount - discountAmount,
    vouchers,
  };
};
