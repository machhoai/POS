// =============================================================================
// Zustand Cart Store — Local-first state management for the cashier
// =============================================================================
// This store manages the cashier's cart entirely in memory for zero-latency
// interaction. When the cashier completes checkout, the cart is persisted to
// Firestore and the local state is cleared.
// =============================================================================

import { create } from "zustand";
import type {
  OrderItem,
  OrderStatus,
  PaymentMethod,
} from "@/lib/types/order";
import {
  checkoutOrder,
  fetchOrderSyncStatus,
  generateLocalOrderId,
  prepareOrder,
  type CheckoutOrderResult,
} from "@/lib/services/orderService";

/** The shape of the cart store. */
interface CartState {
  // ── State ──────────────────────────────────────────────────────────────────
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  draftOrderId: string | null;
  currentOrderId: string | null;
  currentHkOrderNumber: string | null;
  currentOrderStatus: OrderStatus | null;
  isCheckingOut: boolean;

  // ── Computed (derived in selectors, not stored) ────────────────────────────
  // Use `useCartStore(selectTotalAmount)` to get the total.

  // ── Actions ────────────────────────────────────────────────────────────────
  addItem: (item: OrderItem) => void;
  removeItem: (goodsId: string) => void;
  updateQuantity: (goodsId: string, quantity: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  clearCart: () => void;
  prepareCurrentOrder: (shopId: number, warehouseId: string) => Promise<void>;
  refreshCurrentOrderStatus: () => Promise<void>;

  /**
   * Complete the checkout flow:
   * 1. Create a DRAFT order in Firestore
   * 2. Immediately update it to LOCAL_PAID
   * 3. Clear the local cart
   *
   * @param shopId - The shop this order belongs to.
   * @returns The localOrderId of the completed order.
   */
  checkout: (
    shopId: number,
    warehouseId: string,
  ) => Promise<CheckoutOrderResult>;
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
  draftOrderId: null,
  currentOrderId: null,
  currentHkOrderNumber: null,
  currentOrderStatus: null,
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
      return {
        items: [...state.items, item],
        ...(state.items.length === 0
          ? {
              draftOrderId: null,
              currentOrderId: null,
              currentHkOrderNumber: null,
              currentOrderStatus: null,
            }
          : {}),
      };
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
      draftOrderId: null,
      currentOrderId: null,
      currentHkOrderNumber: null,
      currentOrderStatus: null,
      isCheckingOut: false,
    }),

  prepareCurrentOrder: async (shopId, warehouseId) => {
    const state = get();
    if (state.items.length === 0 || state.draftOrderId) return;

    const localOrderId = generateLocalOrderId();
    set({ draftOrderId: localOrderId });

    try {
      const prepared = await prepareOrder({
        localOrderId,
        shopId,
        warehouseId,
        items: state.items.map(({ goodsId, quantity }) => ({
          goodsId,
          quantity,
        })),
      });

      const current = get();
      if (
        current.draftOrderId === localOrderId &&
        current.items.length > 0
      ) {
        set({
          currentOrderId: prepared.localOrderId,
          currentOrderStatus: prepared.status,
        });
      }
    } catch (error: unknown) {
      console.error("[Giỏ hàng] Không thể tạo đơn nháp nền:", error);
    }
  },

  refreshCurrentOrderStatus: async () => {
    const localOrderId = get().currentOrderId;
    if (!localOrderId) return;

    try {
      const result = await fetchOrderSyncStatus(localOrderId);
      if (get().currentOrderId !== localOrderId) return;
      set({
        currentHkOrderNumber: result.hkOrderNumber,
        currentOrderStatus: result.status,
      });
    } catch (error: unknown) {
      console.error("[Giỏ hàng] Không thể tải trạng thái đồng bộ đơn:", error);
    }
  },

  checkout: async (shopId, warehouseId) => {
    const state = get();
    if (state.items.length === 0) {
      throw new Error("Không thể thanh toán khi giỏ hàng trống.");
    }

    set({ isCheckingOut: true });

    try {
      const localOrderId = state.draftOrderId || generateLocalOrderId();
      const result = await checkoutOrder({
        localOrderId,
        shopId,
        warehouseId,
        paymentMethodId: state.paymentMethod,
        items: state.items.map(({ goodsId, quantity }) => ({
          goodsId,
          quantity,
        })),
      });

      set({
        items: [],
        paymentMethod: "CASH",
        draftOrderId: null,
        currentOrderId: result.localOrderId,
        currentHkOrderNumber: result.hkOrderNumber,
        currentOrderStatus: result.status,
        isCheckingOut: false,
      });

      return result;
    } catch (error: unknown) {
      console.error("[Giỏ hàng] Thanh toán Firebase thất bại:", error);
      set({ isCheckingOut: false });
      throw error;
    }
  },
}));
