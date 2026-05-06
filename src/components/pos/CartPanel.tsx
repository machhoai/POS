"use client";

// =============================================================================
// CartPanel — Right-side cart panel with items, totals, and payment actions
// =============================================================================

import type { OrderItem, PaymentMethod } from "@/lib/types/order";
import { formatCurrency } from "@/lib/utils/formatCurrency";

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
  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-alt)]">
      {/* Cart Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-[var(--color-accent)]"
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
            <h2 className="text-sm font-semibold">Giỏ hàng</h2>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">
                {itemCount} sản phẩm
              </span>
              <button
                onClick={onClearCart}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Xóa tất cả
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] px-4">
            <svg
              className="w-10 h-10 mb-2 opacity-30"
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
            <p className="text-xs text-center">
              Chọn sản phẩm để thêm vào giỏ hàng
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <CartItem
                key={item.goodsId}
                item={item}
                onUpdateQuantity={(qty) => onUpdateQuantity(item.goodsId, qty)}
                onRemove={() => onRemoveItem(item.goodsId)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Cart Footer */}
      <div className="border-t border-[var(--color-border)] p-4 space-y-3 shrink-0">
        {/* Payment Method Toggle */}
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                paymentMethod === method.value
                  ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-emerald-700/40"
                  : "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border border-transparent hover:border-[var(--color-border)]"
              }`}
            >
              <span>{method.icon}</span>
              {method.label}
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-[var(--color-text-secondary)]">Tổng cộng</span>
          <span className="text-xl font-bold text-[var(--color-accent)]">
            {formatCurrency(totalAmount)}
          </span>
        </div>

        {/* Checkout Button */}
        <button
          onClick={onCheckout}
          disabled={items.length === 0 || isCheckingOut}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 disabled:shadow-none flex items-center justify-center gap-2"
        >
          {isCheckingOut ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Đang xử lý...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
              </svg>
              Thanh toán
            </>
          )}
        </button>

        {/* Last Order Reference */}
        {currentOrderId && (
          <div className="flex items-center gap-2 p-2 bg-emerald-900/20 border border-emerald-800/30 rounded-lg">
            <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-[10px] text-emerald-300 truncate">
              Đơn gần nhất: <code className="font-mono">{currentOrderId}</code>
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
    <li className="px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {item.goodsName}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {formatCurrency(item.price)} / sản phẩm
          </p>
        </div>
        <button
          onClick={onRemove}
          className="p-0.5 text-[var(--color-text-muted)] hover:text-red-400 transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onUpdateQuantity(item.quantity - 1)}
            className="w-6 h-6 flex items-center justify-center bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-md text-xs hover:bg-[var(--color-surface-active)] transition-colors"
          >
            −
          </button>
          <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            className="w-6 h-6 flex items-center justify-center bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-md text-xs hover:bg-[var(--color-surface-active)] transition-colors"
          >
            +
          </button>
        </div>
        <span className="text-sm font-semibold text-[var(--color-accent)]">
          {formatCurrency(item.price * item.quantity)}
        </span>
      </div>
    </li>
  );
}
