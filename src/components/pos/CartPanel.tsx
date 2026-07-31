"use client";

import { useCallback, useState } from "react";
import CartItem, { EmptyCart } from "@/components/pos/CartItem";
import CheckoutModal from "@/components/pos/CheckoutModal";
import OrderNumberStatus from "@/components/pos/OrderNumberStatus";
import type { AppliedVoucher } from "@/components/pos/VoucherInput";
import type {
  OrderItem,
  OrderStatus,
  PaymentMethod,
} from "@/lib/types/order";
import type { PaymentMethodOption } from "@/lib/types/payment";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { showWarning } from "@/lib/utils/toast";

interface CartPanelProps {
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  paymentMethods: PaymentMethodOption[];
  isCheckingOut: boolean;
  currentOrderId: string | null;
  currentHkOrderNumber: string | null;
  currentOrderStatus: OrderStatus | null;
  totalAmount: number;
  itemCount: number;
  onUpdateQuantity: (goodsId: string, quantity: number) => void;
  onRemoveItem: (goodsId: string) => void;
  onSetPaymentMethod: (method: PaymentMethod) => void;
  onCheckout: () => void | Promise<void>;
  onClearCart: () => void;
}

export default function CartPanel({
  items,
  paymentMethod,
  paymentMethods,
  isCheckingOut,
  currentOrderId,
  currentHkOrderNumber,
  currentOrderStatus,
  totalAmount,
  itemCount,
  onUpdateQuantity,
  onRemoveItem,
  onSetPaymentMethod,
  onCheckout,
  onClearCart,
}: CartPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appliedVoucher, setAppliedVoucher] =
    useState<AppliedVoucher | null>(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);

  const handleApplyVoucher = useCallback(async (code: string) => {
    setIsValidatingVoucher(true);
    console.error("[Giỏ hàng] Chưa có API xác thực/áp dụng voucher:", code);
    showWarning(
      "Chưa thể áp dụng voucher",
      "OpenAPI hiện chưa cung cấp API xác thực và khấu trừ voucher khi tạo đơn.",
    );
    setIsValidatingVoucher(false);
  }, []);

  const closeModal = useCallback(() => {
    if (!isCheckingOut) setIsModalOpen(false);
  }, [isCheckingOut]);

  const confirmCheckout = useCallback(async () => {
    await onCheckout();
    setIsModalOpen(false);
    setAppliedVoucher(null);
  }, [onCheckout]);

  const clearCart = useCallback(() => {
    setIsModalOpen(false);
    setAppliedVoucher(null);
    onClearCart();
  }, [onClearCart]);

  const finalAmount = appliedVoucher
    ? Math.max(0, totalAmount - appliedVoucher.discountAmount)
    : totalAmount;

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-[var(--color-border)] bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
              Đơn hàng hiện tại
            </h2>
            {itemCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-50 px-1.5 text-sm font-bold text-[var(--color-accent)]">
                {itemCount}
              </span>
            )}
          </div>
          <OrderNumberStatus
            localOrderId={currentOrderId}
            hkOrderNumber={currentHkOrderNumber}
            status={currentOrderStatus}
          />
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="flex size-12 items-center justify-center rounded-lg bg-red-500 text-white transition-colors"
            aria-label="Xóa toàn bộ giỏ hàng"
            title="Xóa toàn bộ"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.35 9m-4.78 0-.35-9m9.97-3.21c.34.05.68.11 1.02.17m-1.02-.17-1.07 13.88a2.25 2.25 0 0 1-2.24 2.08H8.08a2.25 2.25 0 0 1-2.24-2.08L4.77 5.79m14.46 0a48.7 48.7 0 0 0-3.48-.4m-12 .57c.34-.06.68-.12 1.02-.17m0 0a48 48 0 0 1 3.48-.4m7.5 0v-.91a2.25 2.25 0 0 0-2.09-2.2 52 52 0 0 0-3.32 0 2.25 2.25 0 0 0-2.09 2.2v.91m7.5 0a48.7 48.7 0 0 0-7.5 0" />
            </svg>
          </button>
        )}
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2">
        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <ul className="space-y-2 py-3">
            {items.map((item) => (
              <CartItem
                key={item.goodsId}
                item={item}
                onUpdateQuantity={(quantity) =>
                  onUpdateQuantity(item.goodsId, quantity)
                }
                onRemove={() => onRemoveItem(item.goodsId)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t border-[var(--color-border)] bg-[#fdfdfc] px-5 pb-5 pt-3">
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm font-bold text-[var(--color-text-primary)]">
            Tổng cộng
          </span>
          <span className="text-xl font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
            {formatCurrency(finalAmount)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={items.length === 0 || isCheckingOut}
          className="flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-sm font-bold text-white shadow-[var(--shadow-glow)] transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.99] disabled:bg-[#dededb] disabled:text-[#a4a49f] disabled:shadow-none"
        >
          Tiếp tục thanh toán
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {isModalOpen && items.length > 0 && (
        <CheckoutModal
          paymentMethod={paymentMethod}
          paymentMethods={paymentMethods}
          totalAmount={totalAmount}
          finalAmount={finalAmount}
          itemCount={itemCount}
          appliedVoucher={appliedVoucher}
          isValidatingVoucher={isValidatingVoucher}
          isCheckingOut={isCheckingOut}
          onSetPaymentMethod={onSetPaymentMethod}
          onApplyVoucher={handleApplyVoucher}
          onRemoveVoucher={() => setAppliedVoucher(null)}
          onClose={closeModal}
          onConfirm={confirmCheckout}
        />
      )}
    </aside>
  );
}
