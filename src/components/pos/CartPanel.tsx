"use client";

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
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);

  const handleApplyVoucher = async (code: string) => {
    setIsValidatingVoucher(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setAppliedVoucher({
        code,
        description: "Giảm 10% đơn hàng",
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
    <aside className="flex flex-col h-full min-h-0 bg-white border-l border-[var(--color-border)]">
      <header className="h-[104px] px-5 flex items-center justify-between border-b border-[var(--color-border)] shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">Đơn hàng hiện tại</h2>
            {itemCount > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-orange-50 text-[10px] font-bold text-[var(--color-accent)] flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            {currentOrderId ? `Gần nhất: ${currentOrderId}` : "Sẵn sàng nhận món"}
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearCart}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Xóa toàn bộ giỏ hàng"
            title="Xóa toàn bộ"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.35 9m-4.78 0-.35-9m9.97-3.21c.34.05.68.11 1.02.17m-1.02-.17-1.07 13.88a2.25 2.25 0 0 1-2.24 2.08H8.08a2.25 2.25 0 0 1-2.24-2.08L4.77 5.79m14.46 0a48.7 48.7 0 0 0-3.48-.4m-12 .57c.34-.06.68-.12 1.02-.17m0 0a48 48 0 0 1 3.48-.4m7.5 0v-.91a2.25 2.25 0 0 0-2.09-2.2 52 52 0 0 0-3.32 0 2.25 2.25 0 0 0-2.09 2.2v.91m7.5 0a48.7 48.7 0 0 0-7.5 0" />
            </svg>
          </button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-5">
        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <CartItem
                key={item.goodsId}
                item={item}
                onUpdateQuantity={(quantity) => onUpdateQuantity(item.goodsId, quantity)}
                onRemove={() => onRemoveItem(item.goodsId)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 px-5 pt-4 pb-5 border-t border-[var(--color-border)] bg-[#fdfdfc] space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <PaymentButton
            active={paymentMethod === "CASH"}
            label="Tiền mặt"
            iconPath="M2.25 6.75A2.25 2.25 0 0 1 4.5 4.5h15a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75Zm6 5.25a3.75 3.75 0 1 0 7.5 0 3.75 3.75 0 0 0-7.5 0ZM18 8.25h.01v.01H18v-.01ZM6 15.75h.01v.01H6v-.01Z"
            onClick={() => onSetPaymentMethod("CASH")}
          />
          <PaymentButton
            active={paymentMethod === "QR_CODE"}
            label="QR Code"
            iconPath="M3.75 4.5A.75.75 0 0 1 4.5 3.75h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-3Zm0 12A.75.75 0 0 1 4.5 15.75h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-3Zm12-12a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-3Zm0 11.25h1.5v1.5h-1.5v-1.5Zm3 0h1.5v4.5h-4.5v-1.5h3v-3Zm-7.5-12h1.5v4.5h-1.5v-4.5Zm0 7.5h4.5v1.5h-3v3h-1.5v-4.5Z"
            onClick={() => onSetPaymentMethod("QR_CODE")}
          />
        </div>

        {items.length > 0 && (
          <VoucherInput
            appliedVoucher={appliedVoucher}
            onApplyVoucher={handleApplyVoucher}
            onRemoveVoucher={() => setAppliedVoucher(null)}
            isValidating={isValidatingVoucher}
          />
        )}

        <div className="space-y-2 py-1">
          <PriceRow label="Tạm tính" value={formatCurrency(totalAmount)} />
          {appliedVoucher && (
            <PriceRow
              label={`Voucher (${appliedVoucher.code})`}
              value={`-${formatCurrency(appliedVoucher.discountAmount)}`}
              accent
            />
          )}
          <div className="border-t border-dashed border-[var(--color-border-subtle)] pt-3 mt-2 flex items-end justify-between gap-3">
            <span className="text-sm font-bold text-[var(--color-text-primary)]">Tổng cộng</span>
            <span className="text-xl font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
              {formatCurrency(finalAmount)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCheckout}
          disabled={items.length === 0 || isCheckingOut}
          className="w-full h-[54px] rounded-xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-[var(--shadow-glow)] hover:bg-[var(--color-accent-hover)] active:scale-[0.99] disabled:bg-[#dededb] disabled:text-[#a4a49f] disabled:shadow-none transition-all"
        >
          {isCheckingOut ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M12 3a9 9 0 0 0-9 9h3a6 6 0 0 1 6-6V3Z" />
              </svg>
              Đang xử lý...
            </>
          ) : (
            <>
              Tiếp tục thanh toán
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
              </svg>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: OrderItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const initials = item.goodsName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <li className="py-4">
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-xl bg-[linear-gradient(145deg,#fff0e5,#ffd5b8)] flex items-center justify-center shrink-0 text-sm font-extrabold text-[var(--color-accent)]">
          {initials || "SP"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold leading-snug text-[var(--color-text-primary)] line-clamp-2">
                {item.goodsName}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-[var(--color-accent)]">
                {formatCurrency(item.price)}
              </p>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
              aria-label={`Xóa ${item.goodsName}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center rounded-lg bg-[var(--color-background)] p-0.5">
              <QuantityButton label="Giảm số lượng" onClick={() => onUpdateQuantity(item.quantity - 1)}>−</QuantityButton>
              <span className="w-7 text-center text-[11px] font-bold tabular-nums">{item.quantity}</span>
              <QuantityButton label="Tăng số lượng" onClick={() => onUpdateQuantity(item.quantity + 1)}>+</QuantityButton>
            </div>
            <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">
              {formatCurrency(item.price * item.quantity)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function QuantityButton({ children, label, onClick }: { children: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold text-[var(--color-text-secondary)] hover:bg-white hover:text-[var(--color-accent)] transition-colors"
    >
      {children}
    </button>
  );
}

function PaymentButton({
  active,
  label,
  iconPath,
  onClick,
}: {
  active: boolean;
  label: string;
  iconPath: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded-xl border flex items-center justify-center gap-2 text-[11px] font-bold transition-colors ${
        active
          ? "border-orange-300 bg-orange-50 text-[var(--color-accent)]"
          : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      {label}
    </button>
  );
}

function PriceRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-[11px] ${accent ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}>
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-5">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.39c.51 0 .95.34 1.09.84l.38 1.43M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.22a60.1 60.1 0 0 0 2.92-7.14 60.1 60.1 0 0 0-16.53-1.84L7.5 14.25ZM6 20.25h.01v.01H6v-.01Zm12.75 0h.01v.01h-.01v-.01Z" />
        </svg>
      </div>
      <p className="text-sm font-bold text-[var(--color-text-primary)]">Giỏ hàng đang trống</p>
      <p className="text-xs leading-relaxed text-[var(--color-text-muted)] mt-1.5 max-w-[210px]">
        Chạm vào một sản phẩm bên trái để thêm vào đơn hàng
      </p>
    </div>
  );
}
