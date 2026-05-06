// =============================================================================
// Zustand Cart Store — Local-first state management for the cashier
// =============================================================================
// This store manages the cashier's cart entirely in memory for zero-latency
// interaction. When the cashier completes checkout, the cart is persisted to
// Firestore and the local state is cleared.
// =============================================================================

import { create } from "zustand";
import type { OrderItem, PaymentMethod } from "@/lib/types/order";
import { createLocalOrder, updateOrderStatus } from "@/lib/services/orderService";

/** The shape of the cart store. */
interface CartState {
  // ── State ──────────────────────────────────────────────────────────────────
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  currentOrderId: string | null;
  isCheckingOut: boolean;

  // ── Computed (derived in selectors, not stored) ────────────────────────────
  // Use `useCartStore(selectTotalAmount)` to get the total.

  // ── Actions ────────────────────────────────────────────────────────────────
  addItem: (item: OrderItem) => void;
  removeItem: (goodsId: string) => void;
  updateQuantity: (goodsId: string, quantity: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  clearCart: () => void;

  /**
   * Complete the checkout flow:
   * 1. Create a DRAFT order in Firestore
   * 2. Immediately update it to LOCAL_PAID
   * 3. Clear the local cart
   *
   * @param shopId - The shop this order belongs to.
   * @returns The localOrderId of the completed order.
   */
  checkout: (shopId: number) => Promise<string>;
}

/** Selector: compute total amount from items. */
export const selectTotalAmount = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

/** Selector: compute total item count. */
export const selectItemCount = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

/**
 * The main cart store.
 * Operates entirely in local memory — Firestore writes only happen on checkout.
 */
export const useCartStore = create<CartState>((set, get) => ({
  // ── Initial State ──────────────────────────────────────────────────────────
  items: [],
  paymentMethod: "CASH",
  currentOrderId: null,
  isCheckingOut: false,

  // ── Actions ────────────────────────────────────────────────────────────────

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.goodsId === item.goodsId);
      if (existing) {
        // Increment quantity if item already in cart
        return {
          items: state.items.map((i) =>
            i.goodsId === item.goodsId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          ),
        };
      }
      // Add new item to cart
      return { items: [...state.items, item] };
    }),

  removeItem: (goodsId) =>
    set((state) => ({
      items: state.items.filter((i) => i.goodsId !== goodsId),
    })),

  updateQuantity: (goodsId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((i) => i.goodsId !== goodsId) };
      }
      return {
        items: state.items.map((i) =>
          i.goodsId === goodsId ? { ...i, quantity } : i
        ),
      };
    }),

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  clearCart: () =>
    set({
      items: [],
      paymentMethod: "CASH",
      currentOrderId: null,
      isCheckingOut: false,
    }),

  checkout: async (shopId) => {
    const state = get();
    if (state.items.length === 0) {
      throw new Error("Cannot checkout with an empty cart.");
    }

    set({ isCheckingOut: true });

    try {
      const totalAmount = selectTotalAmount(state);

      // Step 1: Create order in Firestore as DRAFT
      const localOrderId = await createLocalOrder({
        shopId,
        paymentMethod: state.paymentMethod,
        totalAmount,
        items: state.items,
      });

      // Step 2: Immediately mark as LOCAL_PAID (payment is instant at POS)
      await updateOrderStatus(localOrderId, "LOCAL_PAID");

      // Step 3: Clear the cart and store the order ID for reference
      set({
        items: [],
        paymentMethod: "CASH",
        currentOrderId: localOrderId,
        isCheckingOut: false,
      });

      return localOrderId;
    } catch (error) {
      set({ isCheckingOut: false });
      throw error;
    }
  },
}));
