"use client";

// =============================================================================
// Customer Sub-Display Page — Real-time mirror of the cashier's cart
// =============================================================================
// This page runs in the secondary Tauri window (or at /display in browser).
// It subscribes to Firestore via onSnapshot to show:
//   - Current cart items and total (DRAFT status)
//   - Success screen when payment is completed (LOCAL_PAID status)
// =============================================================================

import { useEffect, useState } from "react";
import { subscribeToLatestOrder } from "@/lib/services/orderService";
import type { PosOrder } from "@/lib/types/order";

export default function CustomerDisplayPage() {
  const [order, setOrder] = useState<PosOrder | null>(null);

  // TODO: Replace with env-based shop ID
  const shopId = Number(process.env.NEXT_PUBLIC_SHOP_ID) || 1;

  useEffect(() => {
    // Subscribe to the latest order for this shop (any status)
    const unsubscribe = subscribeToLatestOrder(shopId, (latestOrder) => {
      setOrder(latestOrder);
    });

    return () => unsubscribe();
  }, [shopId]);

  // ── Render: No active order ────────────────────────────────────────────────
  if (!order) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome</h1>
          <p className="text-gray-400 text-lg">Your order will appear here</p>
        </div>
      </main>
    );
  }

  // ── Render: Payment completed ──────────────────────────────────────────────
  if (order.status === "LOCAL_PAID" || order.status === "SYNC_SUCCESS") {
    return (
      <main className="min-h-screen bg-emerald-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6 animate-bounce">✅</div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Payment Successful!
          </h1>
          <p className="text-emerald-300 text-2xl font-mono mb-4">
            ${order.totalAmount.toFixed(2)}
          </p>
          <p className="text-emerald-400/70 text-sm">
            Order: {order.localOrderId}
          </p>
          {order.paymentMethod === "QR_CODE" && (
            <p className="text-emerald-400/50 text-sm mt-1">Paid via QR Code</p>
          )}
        </div>
      </main>
    );
  }

  // ── Render: Active cart (DRAFT) ────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <header className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-300">Your Order</h1>
      </header>

      {/* Item List */}
      <ul className="space-y-3 mb-8 max-w-lg mx-auto">
        {order.items.map((item, idx) => (
          <li
            key={`${item.goodsId}-${idx}`}
            className="flex justify-between items-center bg-gray-900/50 px-5 py-4 rounded-xl"
          >
            <div>
              <span className="font-medium text-lg">{item.goodsName}</span>
              <span className="text-gray-500 ml-2">×{item.quantity}</span>
            </div>
            <span className="text-emerald-400 font-mono text-lg">
              ${(item.price * item.quantity).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      {/* Total */}
      <div className="max-w-lg mx-auto border-t border-gray-800 pt-6 text-center">
        <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">
          Total
        </p>
        <p className="text-5xl font-bold text-emerald-400 font-mono">
          ${order.totalAmount.toFixed(2)}
        </p>
      </div>
    </main>
  );
}
