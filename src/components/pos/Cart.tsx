"use client";

// =============================================================================
// Cart Component — Skeleton
// =============================================================================
// This component will render the main cart view for the cashier.
// Currently a placeholder — full implementation in the next phase.
// =============================================================================

import { useCartStore, selectTotalAmount } from "@/lib/stores/useCartStore";
import type { OrderItem } from "@/lib/types/order";

interface CartProps {
  onCheckout: () => void;
}

export default function Cart({ onCheckout }: CartProps) {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const totalAmount = useCartStore(selectTotalAmount);

  return (
    <div className="flex flex-col h-full">
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Cart is empty</p>
          </div>
        ) : (
          <ul className="space-y-2 p-4">
            {items.map((item) => (
              <CartItem
                key={item.goodsId}
                item={item}
                onRemove={() => removeItem(item.goodsId)}
                onUpdateQuantity={(qty) => updateQuantity(item.goodsId, qty)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Cart Footer */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-400">Total</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono">
            ${totalAmount.toFixed(2)}
          </span>
        </div>
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-bold text-lg transition-colors"
        >
          Checkout
        </button>
      </div>
    </div>
  );
}

// ── Sub-component: Individual cart item ──────────────────────────────────────

function CartItem({
  item,
  onRemove,
  onUpdateQuantity,
}: {
  item: OrderItem;
  onRemove: () => void;
  onUpdateQuantity: (qty: number) => void;
}) {
  return (
    <li className="flex items-center justify-between bg-gray-900 px-4 py-3 rounded-lg">
      <div className="flex-1">
        <p className="font-medium">{item.goodsName}</p>
        <p className="text-sm text-gray-400">${item.price.toFixed(2)} each</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onUpdateQuantity(item.quantity - 1)}
          className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-md hover:bg-gray-700"
        >
          −
        </button>
        <span className="font-mono w-6 text-center">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.quantity + 1)}
          className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-md hover:bg-gray-700"
        >
          +
        </button>
        <button
          onClick={onRemove}
          className="ml-2 text-red-400 hover:text-red-300 text-sm"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
