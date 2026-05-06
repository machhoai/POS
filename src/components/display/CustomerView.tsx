"use client";

// =============================================================================
// Customer View Component — Real-time order display for the customer
// =============================================================================
// This component is rendered in the customer-facing display window.
// It subscribes to Firestore via onSnapshot to show the current order state.
// =============================================================================

import { useEffect, useState } from "react";
import { subscribeToLatestOrder } from "@/lib/services/orderService";
import type { PosOrder } from "@/lib/types/order";

interface CustomerViewProps {
  shopId: number;
}

export default function CustomerView({ shopId }: CustomerViewProps) {
  const [order, setOrder] = useState<PosOrder | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToLatestOrder(shopId, setOrder);
    return () => unsubscribe();
  }, [shopId]);

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h1 className="text-3xl font-bold text-white">Welcome</h1>
          <p className="text-gray-400 mt-2">Your order will appear here</p>
        </div>
      </div>
    );
  }

  // Show success screen for completed orders
  if (order.status === "LOCAL_PAID" || order.status === "SYNC_SUCCESS") {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6">✅</div>
          <h1 className="text-4xl font-bold text-white mb-3">Thank You!</h1>
          <p className="text-emerald-300 text-3xl font-mono">
            ${order.totalAmount.toFixed(2)}
          </p>
        </div>
      </div>
    );
  }

  // Show active cart
  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-semibold text-center text-gray-300 mb-8">
        Your Order
      </h1>

      <ul className="space-y-3 max-w-lg mx-auto mb-8">
        {order.items.map((item, idx) => (
          <li
            key={`${item.goodsId}-${idx}`}
            className="flex justify-between bg-gray-900/50 px-5 py-4 rounded-xl"
          >
            <span className="font-medium">{item.goodsName} ×{item.quantity}</span>
            <span className="text-emerald-400 font-mono">
              ${(item.price * item.quantity).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      <div className="text-center border-t border-gray-800 pt-6">
        <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">Total</p>
        <p className="text-5xl font-bold text-emerald-400 font-mono">
          ${order.totalAmount.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
