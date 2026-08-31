interface CheckoutModalFooterProps {
  confirmButtonId?: string;
  isCashPayment: boolean;
  hasPaymentSession: boolean;
  hasSufficientCash: boolean;
  missingCash: number;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function CheckoutModalFooter({
  confirmButtonId,
  isCashPayment,
  hasPaymentSession,
  hasSufficientCash,
  missingCash,
  isBusy,
  onClose,
  onConfirm,
}: CheckoutModalFooterProps) {
  return (
    <footer className={`grid shrink-0 gap-3 border-t border-[var(--color-border)] bg-white px-5 py-4 sm:px-6 ${hasPaymentSession ? "grid-cols-1" : "grid-cols-[0.7fr_1.3fr]"}`}>
      <button type="button" onClick={onClose} disabled={isBusy} className="min-h-14 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-[var(--color-text-secondary)] transition hover:bg-gray-50 disabled:opacity-40">
        {hasPaymentSession ? "Đóng cửa sổ" : "Quay lại"}
      </button>
      {!hasPaymentSession && (
        <button
          id={confirmButtonId}
          type="button"
          onClick={onConfirm}
          disabled={isBusy || !hasSufficientCash}
          title={isCashPayment && !hasSufficientCash ? `Còn thiếu ${missingCash.toLocaleString("vi-VN")} đ` : undefined}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition hover:bg-[var(--color-accent-hover)] disabled:bg-[#dededb] disabled:text-[#a4a49f] disabled:shadow-none"
        >
          {isBusy ? (
            <><span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />Đang xử lý...</>
          ) : isCashPayment && !hasSufficientCash ? (
            "Chưa đủ tiền mặt"
          ) : isCashPayment ? (
            "Xác nhận thanh toán"
          ) : (
            "Tạo mã thanh toán"
          )}
        </button>
      )}
    </footer>
  );
}
