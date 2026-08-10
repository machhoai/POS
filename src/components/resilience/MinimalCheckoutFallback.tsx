"use client";

/* eslint-disable @next/next/no-img-element -- Safety mode must render a remote QR without Next image-pipeline dependencies. */

import { Banknote, History, QrCode, RotateCcw, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import type { PayOSCheckoutController } from "@/lib/types/payment";

interface MinimalCheckoutFallbackProps {
  totalAmount: number;
  itemCount: number;
  isBusy: boolean;
  onRetryInterface: () => void;
  onCashPayment: () => void;
  onTransferPayment: () => void;
  onOpenOrders: () => void;
  payment: PayOSCheckoutController;
}

const MinimalCheckoutFallback: React.FC<MinimalCheckoutFallbackProps> = ({
  totalAmount,
  itemCount,
  isBusy,
  onRetryInterface,
  onCashPayment,
  onTransferPayment,
  onOpenOrders,
  payment,
}) => (
  <aside className="flex h-full flex-col border-l border-amber-200 bg-white p-4">
    <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
      <div>
        <h2 className="text-base font-extrabold text-amber-950">
          Chế độ thanh toán an toàn
        </h2>
        <p className="mt-1 text-xs leading-5 text-amber-900">
          Giao diện chính gặp lỗi nhưng giỏ hàng vẫn được giữ. Hãy chọn phương thức
          thanh toán tối thiểu hoặc thử khôi phục giao diện.
        </p>
      </div>
    </div>

    <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4">
      <p className="text-xs font-bold text-[var(--color-text-muted)]">
        {itemCount} sản phẩm
      </p>
      <p className="mt-1 text-2xl font-black text-[var(--color-text-primary)]">
        {formatCurrency(totalAmount)}
      </p>
    </div>

    {payment.session || payment.fixedTransfer ? (
      <TransferRecovery payment={payment} />
    ) : null}

    <div className="mt-4 grid gap-3">
      <button
        type="button"
        onClick={onCashPayment}
        disabled={isBusy || itemCount === 0 || payment.isCartLocked}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
      >
        <Banknote className="size-5" /> Thanh toán tiền mặt
      </button>
      <button
        type="button"
        onClick={onTransferPayment}
        disabled={isBusy || itemCount === 0 || payment.isCartLocked}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 text-sm font-bold text-blue-800 disabled:opacity-50"
      >
        <QrCode className="size-5" /> Thanh toán chuyển khoản
      </button>
    </div>

    <div className="mt-auto grid gap-2 pt-4">
      <button
        type="button"
        onClick={onRetryInterface}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold"
      >
        <RotateCcw className="size-4" /> Khôi phục giao diện
      </button>
      <button
        type="button"
        onClick={onOpenOrders}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-[var(--color-text-secondary)]"
      >
        <History className="size-4" /> Mở lịch sử đơn hàng
      </button>
    </div>
  </aside>
);

function TransferRecovery({ payment }: { payment: PayOSCheckoutController }) {
  const transfer = payment.fixedTransfer;
  const session = payment.session;
  const amount = transfer?.amount ?? session?.amount ?? 0;
  const accountName = transfer?.accountName ?? session?.accountName ?? "";
  const accountNumber = transfer?.accountNumber ?? session?.accountNumber ?? "";
  const description = transfer?.description ?? session?.description ?? "";
  const qrImageUrl = transfer?.qrImageUrl || (
    session?.bin && accountNumber
      ? `https://img.vietqr.io/image/${encodeURIComponent(session.bin)}-${encodeURIComponent(accountNumber)}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`
      : null
  );
  return (
    <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-center">
      <p className="text-xs font-extrabold text-blue-900">Khôi phục thanh toán chuyển khoản</p>
      {qrImageUrl ? <img src={qrImageUrl} alt="Mã QR chuyển khoản" className="mx-auto mt-2 size-44 rounded-xl bg-white object-contain p-2" /> : null}
      <p className="mt-2 text-lg font-black text-blue-950">{formatCurrency(amount)}</p>
      <p className="text-xs font-bold text-blue-900">{accountName} · {accountNumber}</p>
      <p className="mt-1 font-mono text-xs text-blue-700">{description}</p>
      {payment.errorMessage ? <p className="mt-2 text-xs font-semibold text-red-700">{payment.errorMessage}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void payment.checkPayment()} disabled={payment.isBusy} className="min-h-10 rounded-lg border border-blue-300 bg-white px-2 text-xs font-bold text-blue-800 disabled:opacity-50">Kiểm tra thanh toán</button>
        <button type="button" onClick={() => void payment.confirmManually()} disabled={!payment.canConfirmManually || payment.isBusy} className="min-h-10 rounded-lg bg-blue-700 px-2 text-xs font-bold text-white disabled:opacity-50">Xác nhận thủ công</button>
        <button type="button" onClick={() => void payment.cancelPayment()} disabled={payment.isBusy} className="col-span-2 min-h-10 rounded-lg px-2 text-xs font-bold text-red-700 disabled:opacity-50">Hủy mã và quay lại giỏ</button>
      </div>
    </section>
  );
}

export default MinimalCheckoutFallback;
