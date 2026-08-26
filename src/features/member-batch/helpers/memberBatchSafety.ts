import type { MemberBatchItem, MemberBatchSafeStage } from "@/features/member-batch/types/memberBatch";

export function requiresCardReread(stage: MemberBatchSafeStage): boolean {
  return stage === "AWAITING_CARD" || stage === "MEMBER_CREATED";
}

export function recoveryMessage(item: MemberBatchItem): string | null {
  if (item.safeStage === "AWAITING_CARD") {
    return "Phiên trước dừng trước khi tạo thành viên. Bắt buộc đọc lại thẻ để tiếp tục.";
  }
  if (item.safeStage === "MEMBER_CREATED") {
    return "Thành viên đã được tạo nhưng thẻ chưa được xác nhận. Bắt buộc đọc lại thẻ.";
  }
  if (item.safeStage === "CARD_ATTACHED") {
    return item.points > 0
      ? "Thẻ đã gắn thành công. Có thể tiếp tục nạp điểm mà không cần đọc lại thẻ."
      : null;
  }
  return item.errorMessage;
}

