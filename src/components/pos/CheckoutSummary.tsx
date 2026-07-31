import type { AppliedVoucher } from "@/components/pos/VoucherInput";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface CheckoutSummaryProps {
  itemCount: number;
  totalAmount: number;
  finalAmount: number;
  appliedVoucher: AppliedVoucher | null;
}

export default function CheckoutSummary({
  itemCount,
  totalAmount,
  finalAmount,
  appliedVoucher,
}: CheckoutSummaryProps) {
  return (
    <section className="rounded-2xl bg-slate-50 p-4" aria-labelledby="order-summary-title">
      <div className="mb-3 flex items-center justify-between">
        <h3 id="order-summary-title" className="text-sm font-bold text-[var(--color-text-primary)]">
          Tổng thanh toán
        </h3>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">
          {itemCount} sản phẩm
        </span>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
          <span>Tạm tính</span>
          <span className="font-semibold text-[var(--color-text-secondary)]">
            {formatCurrency(totalAmount)}
          </span>
        </div>
        {appliedVoucher && (
          <div className="flex items-center justify-between text-sm text-emerald-600">
            <span>Giảm giá ({appliedVoucher.code})</span>
            <span className="font-bold">
              -{formatCurrency(appliedVoucher.discountAmount)}
            </span>
          </div>
        )}
        <div className="flex items-end justify-between gap-4 border-t border-dashed border-gray-300 pt-3">
          <span className="text-sm font-bold text-[var(--color-text-primary)]">
            Khách cần trả
          </span>
          <span className="text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-accent)]">
            {formatCurrency(finalAmount)}
          </span>
        </div>
      </div>
    </section>
  );
}
