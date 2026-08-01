"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CashPaymentPanel, {
    calculateCashReceived,
    createEmptyBanknoteCounts,
    type BanknoteCounts,
    type VndDenomination,
} from "@/components/pos/CashPaymentPanel";
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
    const [banknoteCounts, setBanknoteCounts] = useState<BanknoteCounts>(
        createEmptyBanknoteCounts,
    );
    const selectedPaymentMethod = paymentMethods.find(
        (method) => method.id === paymentMethod,
    );
    const isCashPayment =
        selectedPaymentMethod?.kind === "cash" || paymentMethod === "CASH";
    const cashReceived = useMemo(
        () => calculateCashReceived(banknoteCounts),
        [banknoteCounts],
    );
    const missingCash = Math.max(0, finalAmount - cashReceived);
    const cashChange = Math.max(0, cashReceived - finalAmount);
    const hasSufficientCash = !isCashPayment || missingCash === 0;

    const incrementBanknote = useCallback((denomination: VndDenomination) => {
        setBanknoteCounts((current) => ({
            ...current,
            [denomination]: current[denomination] + 1,
        }));
    }, []);

    const decrementBanknote = useCallback((denomination: VndDenomination) => {
        setBanknoteCounts((current) => ({
            ...current,
            [denomination]: Math.max(0, current[denomination] - 1),
        }));
    }, []);

    const confirmPayment = useCallback(() => {
        if (!hasSufficientCash) return;
        return onConfirm();
    }, [hasSufficientCash, onConfirm]);

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
                className="flex h-[95dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] outline-none sm:max-w-[80%] sm:rounded-3xl"
            >
                <header className="flex shrink-0 items-center justify-between gap-4">
                    <h2 id="checkout-modal-title" className="px-2 py-2 text-xl w-full text-center font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
                        Thanh toán đơn hàng
                    </h2>
                </header>

                <div className="flex-1 flex-col flex gap-3 overflow-y-auto justify-between px-5 py-2 sm:px-6">
                    <CheckoutPaymentMethods
                        paymentMethod={paymentMethod}
                        methods={paymentMethods}
                        onChange={onSetPaymentMethod}
                    />
                    {isCashPayment && (
                        <CashPaymentPanel
                            counts={banknoteCounts}
                            missingAmount={missingCash}
                            changeAmount={cashChange}
                            onIncrement={incrementBanknote}
                            onDecrement={decrementBanknote}
                        />
                    )}
                    <div className="w-full flex flex-col gap-3">
                        <section className="" aria-labelledby="voucher-title">
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
                            cashPayment={
                                isCashPayment
                                    ? {
                                        receivedAmount: cashReceived,
                                        missingAmount: missingCash,
                                        changeAmount: cashChange,
                                    }
                                    : undefined
                            }
                        />
                    </div>
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
                        onClick={confirmPayment}
                        disabled={
                            isCheckingOut || isValidatingVoucher || !hasSufficientCash
                        }
                        title={
                            isCashPayment && !hasSufficientCash
                                ? `Còn thiếu ${missingCash.toLocaleString("vi-VN")} đ`
                                : undefined
                        }
                        className="flex min-h-14 touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:bg-[#dededb] disabled:text-[#a4a49f] disabled:shadow-none"
                    >
                        {isCheckingOut ? (
                            <LoadingLabel />
                        ) : isCashPayment && !hasSufficientCash ? (
                            <InsufficientCashLabel />
                        ) : (
                            <ConfirmLabel />
                        )}
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

function InsufficientCashLabel() {
    return (
        <>
            Chưa đủ tiền mặt
            <svg
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.2}
                stroke="currentColor"
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-1.5a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 16.5h.008v.008H12V16.5Z"
                />
            </svg>
        </>
    );
}
