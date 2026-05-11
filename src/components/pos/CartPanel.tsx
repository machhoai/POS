"use client";

// =============================================================================
// CartPanel — Giỏ hàng POS, tối ưu UX cảm ứng
// =============================================================================

import { useState } from "react";
import type { OrderItem, PaymentMethod } from "@/lib/types/order";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import VoucherInput, { type AppliedVoucher } from "@/components/pos/VoucherInput";

interface CartPanelProps {
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  isCheckingOut: boolean;
  currentOrderId: string | null;
  totalAmount: number;
  itemCount: number;
  onUpdateQuantity: (goodsId: string, quantity: number) => void;
  onRemoveItem: (goodsId: string) => void;
  onSetPaymentMethod: (method: PaymentMethod) => void;
  onCheckout: () => void;
  onClearCart: () => void;
}

export default function CartPanel({
  items,
  paymentMethod,
  isCheckingOut,
  currentOrderId,
  totalAmount,
  itemCount,
  onUpdateQuantity,
  onRemoveItem,
  onSetPaymentMethod,
  onCheckout,
  onClearCart,
}: CartPanelProps) {
  // Voucher state — quản lý local, chưa có API validate
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);

  const handleApplyVoucher = async (code: string) => {
    setIsValidatingVoucher(true);
    try {
      // TODO: Gọi API validate voucher khi sẵn sàng
      // Tạm mock: mọi mã đều hợp lệ, giảm 10%
      await new Promise((r) => setTimeout(r, 800));
      setAppliedVoucher({
        code,
        description: `Giảm 10% đơn hàng`,
        discountAmount: Math.round(totalAmount * 0.1),
      });
    } catch {
      console.error("[Cart] Voucher không hợp lệ:", code);
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  const finalAmount = appliedVoucher
    ? Math.max(0, totalAmount - appliedVoucher.discountAmount)
    : totalAmount;

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-alt)]">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center">
              <svg
                className="w-4.5 h-4.5 text-[var(--color-accent)]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold">Giỏ hàng</h2>
              {items.length > 0 && (
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {itemCount} sản phẩm
                </span>
              )}
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={onClearCart}
              className="px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 active:bg-red-500/10 rounded-lg transition-colors min-h-[40px]"
            >
              Xóa tất cả
            </button>
          )}
        </div>
      </div>

      {/* Danh sách sản phẩm */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] px-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-hover)] flex items-center justify-center mb-3">
              <svg
                className="w-8 h-8 opacity-30"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                />
              </svg>
            </div>
            <p className="text-sm text-center">
              Chọn sản phẩm để thêm vào giỏ hàng
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <CartItem
                key={item.goodsId}
                item={item}
                onUpdateQuantity={(qty) =>
                  onUpdateQuantity(item.goodsId, qty)
                }
                onRemove={() => onRemoveItem(item.goodsId)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer — Thanh toán */}
      <div className="border-t border-[var(--color-border)] p-4 space-y-3 shrink-0">
        {/* Phương thức thanh toán */}
        <div className="flex gap-2">
          {(
            [
              { value: "CASH", label: "Tiền mặt", icon: "💵" },
              { value: "QR_CODE", label: "QR Code", icon: "📱" },
            ] as const
          ).map((method) => (
            <button
              key={method.value}
              onClick={() => onSetPaymentMethod(method.value)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all min-h-[48px] ${
                paymentMethod === method.value
                  ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-2 border-emerald-700/50"
                  : "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-2 border-transparent active:bg-[var(--color-surface-active)]"
              }`}
            >
              <span className="text-lg">{method.icon}</span>
              {method.label}
            </button>
          ))}
        </div>

        {/* Voucher */}
        {items.length > 0 && (
          <VoucherInput
            appliedVoucher={appliedVoucher}
            onApplyVoucher={handleApplyVoucher}
            onRemoveVoucher={() => setAppliedVoucher(null)}
            isValidating={isValidatingVoucher}
          />
        )}

        {/* Tổng tiền */}
        <div className="space-y-1 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Tạm tính
            </span>
            <span className="text-sm text-[var(--color-text-secondary)]">
              {formatCurrency(totalAmount)}
            </span>
          </div>
          {appliedVoucher && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-400">
                Voucher ({appliedVoucher.code})
              </span>
              <span className="text-sm font-medium text-amber-400">
                -{formatCurrency(appliedVoucher.discountAmount)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Tổng cộng
            </span>
            <span className="text-2xl font-bold text-[var(--color-accent)]">
              {formatCurrency(finalAmount)}
            </span>
          </div>
        </div>

        {/* Nút thanh toán */}
        <button
          onClick={onCheckout}
          disabled={items.length === 0 || isCheckingOut}
          className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white text-base font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 disabled:shadow-none flex items-center justify-center gap-2.5 min-h-[56px]"
        >
          {isCheckingOut ? (
            <>
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Đang xử lý...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
                />
              </svg>
              Thanh toán
            </>
          )}
        </button>

        {/* Đơn hàng gần nhất */}
        {currentOrderId && (
          <div className="flex items-center gap-2.5 p-3 bg-emerald-900/20 border border-emerald-800/30 rounded-xl">
            <svg
              className="w-4 h-4 text-emerald-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p className="text-[11px] text-emerald-300 truncate">
              Đơn gần nhất:{" "}
              <code className="font-mono">{currentOrderId}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-component ──────────────────────────────────────────────────────────

function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: OrderItem;
  onUpdateQuantity: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <li className="px-4 py-3.5">
      {/* Hàng 1: Tên + Xóa */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2 leading-snug">
            {item.goodsName}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {formatCurrency(item.price)} / sản phẩm
          </p>
        </div>
        <button
          onClick={onRemove}
          className="w-9 h-9 flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-400 active:bg-red-500/10 rounded-lg transition-colors shrink-0"
          aria-label="Xóa sản phẩm"
        >
          <svg
            className="w-4.5 h-4.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
          </svg>
        </button>
      </div>

      {/* Hàng 2: Tăng/Giảm + Thành tiền */}
      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onUpdateQuantity(item.quantity - 1)}
            className="w-10 h-10 flex items-center justify-center bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-base font-bold active:bg-[var(--color-surface-active)] transition-colors"
          >
            −
          </button>
          <span className="w-12 text-center text-base font-bold tabular-nums">
            {item.quantity}
          </span>
          <button
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            className="w-10 h-10 flex items-center justify-center bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-base font-bold active:bg-[var(--color-surface-active)] transition-colors"
          >
            +
          </button>
        </div>
        <span className="text-base font-bold text-[var(--color-accent)]">
          {formatCurrency(item.price * item.quantity)}
        </span>
      </div>
    </li>
  );
}
