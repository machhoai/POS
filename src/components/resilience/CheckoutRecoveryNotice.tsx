"use client";

import { ShieldCheck, X } from "lucide-react";
import type { CheckoutCheckpoint } from "@/lib/types/checkoutRecovery";

interface CheckoutRecoveryNoticeProps {
  checkpoint: CheckoutCheckpoint;
  onDismiss: () => void;
  onOpenOrders: () => void;
}

const RECOVERY_MESSAGE: Record<CheckoutCheckpoint, string> = {
  CART_READY: "Giỏ hàng trước đó đã được khôi phục an toàn.",
  PAYMENT_INITIATED:
    "Đã khôi phục phiên thanh toán đang dở. Hãy kiểm tra trạng thái trước khi tạo giao dịch mới.",
  PAYMENT_CONFIRMED:
    "Thanh toán trước đó đã được ghi nhận. Hãy kiểm tra biên lai trong lịch sử đơn hàng.",
  RECEIPT_PENDING:
    "Thanh toán đã hoàn tất nhưng biên lai có thể chưa in. Bạn có thể in lại từ lịch sử.",
  SYNC_PENDING:
    "Đơn đã thanh toán và đang chờ đồng bộ nền.",
  COMPLETED: "Giao dịch trước đó đã hoàn tất.",
};

const CheckoutRecoveryNotice: React.FC<CheckoutRecoveryNoticeProps> = ({
  checkpoint,
  onDismiss,
  onOpenOrders,
}) => (
  <div className="fixed inset-x-4 top-3 z-[120] mx-auto flex max-w-2xl items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl">
    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-extrabold text-emerald-900">
        JPOS đã phục hồi dữ liệu giao dịch
      </p>
      <p className="mt-1 text-xs leading-5 text-emerald-800">
        {RECOVERY_MESSAGE[checkpoint]}
      </p>
      {["PAYMENT_CONFIRMED", "RECEIPT_PENDING", "SYNC_PENDING"].includes(
        checkpoint,
      ) ? (
        <button
          type="button"
          onClick={onOpenOrders}
          className="mt-2 text-xs font-bold text-emerald-800 underline underline-offset-2"
        >
          Mở lịch sử đơn hàng
        </button>
      ) : null}
    </div>
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Đóng thông báo phục hồi"
      className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-50"
    >
      <X className="size-4" />
    </button>
  </div>
);

export default CheckoutRecoveryNotice;
