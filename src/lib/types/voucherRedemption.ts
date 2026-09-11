export type VoucherRedemptionMode = "REDEEM" | "CHECK";
export type VoucherRedemptionResultStatus =
  | "PENDING"
  | "CHECKED"
  | "COMPLETED"
  | "PRINT_FAILED"
  | "FAILED";

export interface VoucherRedemptionResult {
  id: string;
  code: string;
  status: VoucherRedemptionResultStatus;
  title: string;
  detail: string;
  orderId?: string;
  campaignName?: string;
  rewardType?: "DISCOUNT_PERCENT" | "FREE_TICKET" | "FREE_ITEM";
  rewardValue?: number;
  productName?: string;
  productQuantity?: number;
  productPrice?: number;
  orderTotalAmount?: number;
  timestamp: number;
}
