"use client";

import { useEffect, useRef } from "react";
import CheckoutPaymentMethods from "@/components/pos/CheckoutPaymentMethods";
import CheckoutSummary from "@/components/pos/CheckoutSummary";
import VoucherInput, {
  type AppliedVoucher,
} from "@/components/pos/VoucherInput";
import type { PaymentMethod } from "@/lib/types/order";
import type { PaymentMethodOption } from "@/lib/types/payment";

interface CheckoutModalProps {
  paymentMethod: PaymentMethod;
  paymentMethods: PaymentMethodOption[];
  totalAmount: number;
  finalAmount: number;
  itemCount: number;
  appliedVoucher: AppliedVoucher | null;
  isValidatingVoucher: boolean;
  isCheckingOut: boolean;
  onSetPaymentMethod: (method: PaymentMethod) => void;
  onApplyVoucher: (code: string) => void;
  onRemoveVoucher: () => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function CheckoutModal({
  paymentMethod,
  paymentMethods,
  totalAmount,
  finalAmount,
  itemCount,
  appliedVoucher,
  isValidatingVoucher,
  isCheckingOut,
  onSetPaymentMethod,
  onApplyVoucher,
  onRemoveVoucher,
  onClose,
  onConfirm,
}: CheckoutModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-modal-title"
        aria-describedby="checkout-modal-description"
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] outline-none sm:max-w-[620px] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[var(--color-accent)]">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 9h10.5A2.25 2.25 0 0 0 19.5 17.25v-6A2.25 2.25 0 0 0 17.25 9H6.75A2.25 2.25 0 0 0 4.5 11.25v6a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="checkout-modal-title" className="text-lg font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
                Thanh toán đơn hàng
              </h2>
              <p id="checkout-modal-description" className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                Kiểm tra thông tin trước khi hoàn tất
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCheckingOut}
            className="flex size-12 shrink-0 touch-manipulation items-center justify-center rounded-2xl bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 active:scale-95 disabled:opacity-40"
            aria-label="Đóng cửa sổ thanh toán"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <CheckoutPaymentMethods
            paymentMethod={paymentMethod}
            methods={paymentMethods}
            onChange={onSetPaymentMethod}
          />
          <section className="rounded-2xl border border-[var(--color-border)] bg-[#fdfdfc] p-4" aria-labelledby="voucher-title">
            <div className="mb-3">
              <h3 id="voucher-title" className="text-sm font-bold text-[var(--color-text-primary)]">
                Voucher
                <span className="ml-1.5 font-medium text-[var(--color-text-muted)]">
                  (không bắt buộc)
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                Nhập hoặc quét mã ưu đãi của khách hàng
              </p>
            </div>
            <VoucherInput
              appliedVoucher={appliedVoucher}
              onApplyVoucher={onApplyVoucher}
              onRemoveVoucher={onRemoveVoucher}
              isValidating={isValidatingVoucher}
            />
          </section>
          <CheckoutSummary
            itemCount={itemCount}
            totalAmount={totalAmount}
            finalAmount={finalAmount}
            appliedVoucher={appliedVoucher}
          />
        </div>

        <footer className="grid shrink-0 grid-cols-[0.7fr_1.3fr] gap-3 border-t border-[var(--color-border)] bg-white px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isCheckingOut}
            className="min-h-14 touch-manipulation rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-gray-50 active:scale-[0.98] disabled:opacity-40"
          >
            Quay lại
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCheckingOut || isValidatingVoucher}
            className="flex min-h-14 touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:bg-[#dededb] disabled:text-[#a4a49f] disabled:shadow-none"
          >
            {isCheckingOut ? <LoadingLabel /> : <ConfirmLabel />}
          </button>
        </footer>
      </div>
    </div>
  );
}

function LoadingLabel() {
  return (
    <>
      <svg className="size-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-90" fill="currentColor" d="M12 3a9 9 0 0 0-9 9h3a6 6 0 0 1 6-6V3Z" />
      </svg>
      Đang xử lý...
    </>
  );
}

function ConfirmLabel() {
  return (
    <>
      Xác nhận thanh toán
      <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 4.5 4.5 10.5-10.5" />
      </svg>
    </>
  );
}
