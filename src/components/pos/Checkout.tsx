"use client";

// =============================================================================
// Checkout Component — Skeleton
// =============================================================================
// Handles payment method selection and order finalization.
// Currently a placeholder — full implementation in the next phase.
// =============================================================================

import { useCartStore } from "@/lib/stores/useCartStore";
import type { PaymentMethod } from "@/lib/types/order";

interface CheckoutProps {
  warehouseId: string;
  onComplete: (orderId: string) => void;
  onCancel: () => void;
}

export default function Checkout({
  warehouseId,
  onComplete,
  onCancel,
}: CheckoutProps) {
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const setPaymentMethod = useCartStore((s) => s.setPaymentMethod);
  const isCheckingOut = useCartStore((s) => s.isCheckingOut);
  const checkout = useCartStore((s) => s.checkout);

  // TODO: Replace with env-based shop ID
  const shopId = Number(process.env.NEXT_PUBLIC_SHOP_ID) || 1;

  const handleCheckout = async () => {
    try {
      const result = await checkout(shopId, warehouseId);
      onComplete(result.localOrderId);
    } catch (err) {
      console.error("[Thanh toán] Thất bại:", err);
    }
  };

  const paymentMethods: { value: PaymentMethod; label: string; icon: string }[] = [
    { value: "CASH", label: "Tiền mặt", icon: "💵" },
    { value: "QR_CODE", label: "Chuyển khoản", icon: "📱" },
  ];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">Chọn phương thức thanh toán</h2>

      {/* Payment Method Selection */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {paymentMethods.map((method) => (
          <button
            key={method.value}
            onClick={() => setPaymentMethod(method.value)}
            className={`p-6 rounded-xl text-center transition-all ${
              paymentMethod === method.value
                ? "bg-emerald-600/20 border-2 border-emerald-500 scale-105"
                : "bg-gray-900 border-2 border-transparent hover:border-gray-700"
            }`}
          >
            <span className="text-3xl block mb-2">{method.icon}</span>
            <span className="font-medium">{method.label}</span>
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
        >
          Quay lại
        </button>
        <button
          onClick={handleCheckout}
          disabled={isCheckingOut}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 rounded-lg font-bold transition-colors"
        >
          {isCheckingOut ? "Đang xử lý..." : "Xác nhận thanh toán"}
        </button>
      </div>
    </div>
  );
}
