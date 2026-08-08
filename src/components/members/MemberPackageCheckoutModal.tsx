"use client";

import { useMemo, useState } from "react";
import CashPaymentPanel, {
  calculateCashReceived,
  createEmptyBanknoteCounts,
  type BanknoteCounts,
  type VndDenomination,
} from "@/components/pos/CashPaymentPanel";
import CheckoutPaymentMethods from "@/components/pos/CheckoutPaymentMethods";
import PayOSQrPanel from "@/components/pos/PayOSQrPanel";
import { JPOS_PAYMENT_METHODS } from "@/lib/data/paymentMethods";
import type { MemberPointPackage } from "@/lib/types/member";
import type { PaymentMethod } from "@/lib/types/order";
import type { PayOSCheckoutController } from "@/lib/types/payment";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface MemberPackageCheckoutModalProps {
  selectedPackage: MemberPointPackage;
  paymentMethod: PaymentMethod;
  mutationBusy: boolean;
  payOSPayment: PayOSCheckoutController;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onClose: () => void;
  onCashConfirm: () => void;
  onQrConfirm: () => void;
}

export default function MemberPackageCheckoutModal(props: MemberPackageCheckoutModalProps) {
  const [banknotes, setBanknotes] = useState<BanknoteCounts>(createEmptyBanknoteCounts);
  const cashReceived = useMemo(() => calculateCashReceived(banknotes), [banknotes]);
  const isCash = props.paymentMethod === "CASH";
  const missing = Math.max(0, props.selectedPackage.paymentAmountVnd - cashReceived);
  const change = Math.max(0, cashReceived - props.selectedPackage.paymentAmountVnd);
  const hasQrSession = !isCash && (Boolean(props.payOSPayment.session) || props.payOSPayment.isCartLocked);
  const busy = props.mutationBusy || props.payOSPayment.isBusy;
  const changeBanknote = (value: VndDenomination, delta: number) => setBanknotes((current) => ({ ...current, [value]: Math.max(0, current[value] + delta) }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-5">
      <div role="dialog" aria-modal="true" className="flex h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-xl font-extrabold">Thanh toán gói thành viên</h2><p className="text-sm text-slate-500">{props.selectedPackage.name} · {formatCurrency(props.selectedPackage.paymentAmountVnd)}</p></div><button type="button" onClick={props.onClose} disabled={busy || Boolean(props.payOSPayment.session)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold disabled:opacity-40">Đóng</button></header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {hasQrSession ? <PayOSQrPanel payment={props.payOSPayment} /> : <>
            <CheckoutPaymentMethods paymentMethod={props.paymentMethod} methods={JPOS_PAYMENT_METHODS} onChange={props.onPaymentMethodChange} />
            {isCash ? <CashPaymentPanel counts={banknotes} missingAmount={missing} changeAmount={change} onIncrement={(value) => changeBanknote(value, 1)} onDecrement={(value) => changeBanknote(value, -1)} /> : <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center"><p className="font-extrabold text-blue-900">Chuyển khoản qua PayOS</p><p className="mt-1 text-sm text-blue-700">Mã QR sẽ được tạo đúng số tiền của gói sau khi OpenAPI xác minh giá.</p></div>}
            <div className="mt-auto grid gap-2 sm:grid-cols-2"><button type="button" onClick={props.onClose} disabled={busy} className="min-h-14 rounded-2xl border border-slate-300 text-sm font-bold disabled:opacity-50">Quay lại</button><button id={isCash ? "member-package-confirm-cash" : "member-package-start-qr"} type="button" onClick={isCash ? props.onCashConfirm : props.onQrConfirm} disabled={busy || (isCash && missing > 0)} className="min-h-14 rounded-2xl bg-[var(--color-accent)] px-5 font-extrabold text-white disabled:opacity-40">{busy ? "Đang xử lý..." : isCash ? "Xác nhận đã nhận tiền" : "Tạo mã QR thanh toán"}</button></div>
          </>}
        </div>
      </div>
    </div>
  );
}
