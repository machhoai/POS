"use client";

import { TicketCheck, X } from "lucide-react";
import { useState } from "react";

import type { PosVoucherResolution } from "@/lib/types/voucher";

interface VoucherInputProps {
  appliedVouchers: PosVoucherResolution[];
  onApplyVoucher: (code: string) => void;
  onRemoveVoucher: (code: string) => void;
  isValidating?: boolean;
}

const describeVoucher = (voucher: PosVoucherResolution): string => {
  if (voucher.rewardType === "DISCOUNT_PERCENT") {
    return `Giảm ${voucher.rewardValue}% toàn đơn`;
  }
  return `${voucher.product.goodsName} × ${voucher.product.quantity}`;
};

export default function VoucherInput({
  appliedVouchers,
  onApplyVoucher,
  onRemoveVoucher,
  isValidating = false,
}: VoucherInputProps) {
  const [code, setCode] = useState("");

  const submit = () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized || isValidating) return;
    onApplyVoucher(normalized);
    setCode("");
  };

  return (
    <section className="space-y-2" aria-label="Voucher của đơn hàng">
      {appliedVouchers.length > 0 ? (
        <div className="space-y-1.5">
          {appliedVouchers.map((voucher) => (
            <div
              key={voucher.code}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5"
            >
              <TicketCheck className="shrink-0 text-amber-600" size={18} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-amber-900">
                  {voucher.code}
                </p>
                <p className="truncate text-xs text-amber-700">
                  {describeVoucher(voucher)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveVoucher(voucher.code)}
                disabled={isValidating}
                aria-label={`Bỏ voucher ${voucher.code}`}
                className="flex size-10 items-center justify-center rounded-lg text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                <X size={17} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          disabled={isValidating}
          placeholder="Quét hoặc nhập mã voucher"
          autoComplete="off"
          className="min-h-12 flex-1 rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm uppercase tracking-wider outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!code.trim() || isValidating}
          className="min-h-12 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isValidating ? "Đang kiểm tra…" : "Áp dụng"}
        </button>
      </div>
    </section>
  );
}
