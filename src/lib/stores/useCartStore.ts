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
import {
  clearCheckoutJournal,
  loadCheckoutJournal,
  recordPendingFailure,
  saveCheckoutJournal,
} from "@/lib/services/checkoutJournalService";
import type {
  CheckoutCheckpoint,
  CheckoutJournalRecord,
} from "@/lib/types/checkoutRecovery";

interface CheckoutContext {
  shopId: number;
  warehouseId: string;
}

/** The shape of the cart store. */
export interface CartState {
  // ── State ──────────────────────────────────────────────────────────────────
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  draftOrderId: string | null;
  currentOrderId: string | null;
  currentHkOrderNumber: string | null;
  currentOrderStatus: OrderStatus | null;
  isCheckingOut: boolean;
  isPaymentLocked: boolean;
  paymentLockOrderId: string | null;
  checkoutContext: CheckoutContext | null;
  checkoutCheckpoint: CheckoutCheckpoint | null;
  journalHydrated: boolean;
  recoveryNotice: CheckoutCheckpoint | null;

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
  completePayOSCheckout: (
    localOrderId: string,
    status: OrderStatus,
  ) => void;
  lockCartForPayOS: (localOrderId: string) => boolean;
  unlockCartAfterPayOSCancellation: (localOrderId: string) => void;
  setCheckoutContext: (shopId: number, warehouseId: string) => void;
  hydrateCheckoutJournal: () => Promise<void>;
  dismissRecoveryNotice: () => void;
  markReceiptPrinted: (localOrderId: string) => void;

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

function saveCartCheckpoint(
  state: CartState,
  checkpoint: CheckoutCheckpoint,
  overrides: Partial<CheckoutJournalRecord> = {},
): void {
  const context = state.checkoutContext;
  if (!context) return;
  const now = new Date().toISOString();
  const items = overrides.items ?? state.items;
  void saveCheckoutJournal({
    id: "active-checkout",
    schemaVersion: 1,
    checkpoint,
    localOrderId:
      overrides.localOrderId ?? state.currentOrderId ?? state.draftOrderId,
    shopId: context.shopId,
    warehouseId: context.warehouseId,
    items,
    paymentMethod: overrides.paymentMethod ?? state.paymentMethod,
    totalAmount:
      overrides.totalAmount ??
      items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    orderStatus: overrides.orderStatus ?? state.currentOrderStatus,
    startedAt: overrides.startedAt ?? now,
    updatedAt: now,
    lastError: overrides.lastError ?? null,
    recoveryCount: overrides.recoveryCount ?? 0,
  });
}

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
  isPaymentLocked: false,
  paymentLockOrderId: null,
  checkoutContext: null,
  checkoutCheckpoint: null,
  journalHydrated: false,
  recoveryNotice: null,

  // ── Actions ────────────────────────────────────────────────────────────────

  addItem: (item) => {
    set((state) => {
      if (state.isPaymentLocked) return {};
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
    });
    saveCartCheckpoint(get(), "CART_READY");
  },

  removeItem: (goodsId) => {
    set((state) => state.isPaymentLocked
      ? {}
      : { items: state.items.filter((i) => i.goodsId !== goodsId) });
    const current = get();
    if (current.items.length === 0) void clearCheckoutJournal();
    else saveCartCheckpoint(current, "CART_READY");
  },

  updateQuantity: (goodsId, quantity) => {
    set((state) => {
      if (state.isPaymentLocked) return {};
      if (quantity <= 0) {
        return { items: state.items.filter((i) => i.goodsId !== goodsId) };
      }
      return {
        items: state.items.map((i) =>
          i.goodsId === goodsId ? { ...i, quantity } : i
        ),
      };
    });
    const current = get();
    if (current.items.length === 0) void clearCheckoutJournal();
    else saveCartCheckpoint(current, "CART_READY");
  },

  setPaymentMethod: (method) => {
    if (get().isPaymentLocked) return;
    set({ paymentMethod: method });
    if (get().items.length > 0) saveCartCheckpoint(get(), "CART_READY");
  },

  clearCart: () => {
    if (get().isPaymentLocked) return;
    set({
      items: [],
      paymentMethod: "CASH",
      draftOrderId: null,
      currentOrderId: null,
      currentHkOrderNumber: null,
      currentOrderStatus: null,
      isCheckingOut: false,
      checkoutCheckpoint: null,
      recoveryNotice: null,
    });
    void clearCheckoutJournal();
  },

  setCheckoutContext: (shopId, warehouseId) => {
    set({ checkoutContext: { shopId, warehouseId } });
    const current = get();
    if (current.journalHydrated && current.items.length > 0) {
      saveCartCheckpoint(current, "CART_READY");
    }
  },

  hydrateCheckoutJournal: async () => {
    if (get().journalHydrated) return;
    const context = get().checkoutContext;
    if (!context) return;
    const journal = await loadCheckoutJournal();
    if (!journal || journal.checkpoint === "COMPLETED") {
      set({ journalHydrated: true });
      if (journal?.checkpoint === "COMPLETED") void clearCheckoutJournal();
      return;
    }
    if (journal.warehouseId !== context.warehouseId) {
      set({ journalHydrated: true });
      return;
    }

    const recoveryCount = journal.recoveryCount + 1;
    const paymentPending = journal.checkpoint === "PAYMENT_INITIATED";
    const paymentFinished = [
      "PAYMENT_CONFIRMED",
      "RECEIPT_PENDING",
      "SYNC_PENDING",
    ].includes(journal.checkpoint);
    set({
      items: paymentFinished ? [] : journal.items,
      paymentMethod: journal.paymentMethod,
      draftOrderId: paymentFinished ? null : journal.localOrderId,
      currentOrderId: journal.localOrderId,
      currentOrderStatus: journal.orderStatus,
      isPaymentLocked: paymentPending && journal.paymentMethod === "QR_CODE",
      paymentLockOrderId:
        paymentPending && journal.paymentMethod === "QR_CODE"
          ? journal.localOrderId
          : null,
      checkoutCheckpoint: journal.checkpoint,
      journalHydrated: true,
      recoveryNotice: journal.checkpoint,
    });
    void saveCheckoutJournal({
      ...journal,
      recoveryCount,
      updatedAt: new Date().toISOString(),
    });
  },

  dismissRecoveryNotice: () => set({ recoveryNotice: null }),

  markReceiptPrinted: (localOrderId) => {
    const state = get();
    if (state.currentOrderId !== localOrderId) return;
    set({ checkoutCheckpoint: "SYNC_PENDING" });
    saveCartCheckpoint(get(), "SYNC_PENDING", { localOrderId });
  },

  prepareCurrentOrder: async (shopId, warehouseId) => {
    const state = get();
    if (state.isPaymentLocked || state.items.length === 0 || state.draftOrderId) {
      return;
    }

    const localOrderId = generateLocalOrderId();
    set({ draftOrderId: localOrderId });
    saveCartCheckpoint(get(), "CART_READY", { localOrderId });

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
      if (
        result.status === "SYNC_SUCCESS" &&
        get().checkoutCheckpoint === "SYNC_PENDING"
      ) {
        set({ checkoutCheckpoint: "COMPLETED" });
        void clearCheckoutJournal();
      }
    } catch (error: unknown) {
      console.error("[Giỏ hàng] Không thể tải trạng thái đồng bộ đơn:", error);
    }
  },

  completePayOSCheckout: (localOrderId, status) => {
    const previous = get();
    saveCartCheckpoint(previous, "RECEIPT_PENDING", {
      localOrderId,
      orderStatus: status,
      items: previous.items,
    });
    set({
      items: [],
      paymentMethod: "CASH",
      draftOrderId: null,
      currentOrderId: localOrderId,
      currentHkOrderNumber: null,
      currentOrderStatus: status,
      isCheckingOut: false,
      isPaymentLocked: false,
      paymentLockOrderId: null,
      checkoutCheckpoint: "RECEIPT_PENDING",
    });
  },

  lockCartForPayOS: (localOrderId) => {
    const state = get();
    if (
      state.items.length === 0 ||
      (state.isPaymentLocked && state.paymentLockOrderId !== localOrderId)
    ) {
      return false;
    }
    set({
      isPaymentLocked: true,
      paymentLockOrderId: localOrderId,
      draftOrderId: localOrderId,
      checkoutCheckpoint: "PAYMENT_INITIATED",
    });
    saveCartCheckpoint(get(), "PAYMENT_INITIATED", { localOrderId });
    return true;
  },

  unlockCartAfterPayOSCancellation: (localOrderId) => {
    if (get().paymentLockOrderId !== localOrderId) return;
    set({
      isPaymentLocked: false,
      paymentLockOrderId: null,
      checkoutCheckpoint: "CART_READY",
    });
    saveCartCheckpoint(get(), "CART_READY", { localOrderId });
  },

  checkout: async (shopId, warehouseId) => {
    const state = get();
    if (state.isPaymentLocked) {
      throw new Error("Phải hủy mã chuyển khoản trước khi sửa hoặc thanh toán lại đơn.");
    }
    if (state.items.length === 0) {
      throw new Error("Không thể thanh toán khi giỏ hàng trống.");
    }

    const localOrderId = state.draftOrderId || generateLocalOrderId();
    set({
      isCheckingOut: true,
      draftOrderId: localOrderId,
      checkoutCheckpoint: "PAYMENT_INITIATED",
    });
    saveCartCheckpoint(get(), "PAYMENT_INITIATED", {
      localOrderId,
      items: state.items,
    });

    try {
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

      saveCartCheckpoint(get(), "RECEIPT_PENDING", {
        localOrderId: result.localOrderId,
        items: state.items,
        paymentMethod: state.paymentMethod,
        totalAmount: state.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        ),
        orderStatus: result.status,
      });

      set({
        items: [],
        paymentMethod: "CASH",
        draftOrderId: null,
        currentOrderId: result.localOrderId,
        currentHkOrderNumber: result.hkOrderNumber,
        currentOrderStatus: result.status,
        isCheckingOut: false,
        checkoutCheckpoint: "RECEIPT_PENDING",
      });

      return result;
    } catch (error: unknown) {
      console.error("[Giỏ hàng] Thanh toán Firebase thất bại:", error);
      set({
        isCheckingOut: false,
        checkoutCheckpoint: "PAYMENT_INITIATED",
      });
      saveCartCheckpoint(get(), "PAYMENT_INITIATED", {
        localOrderId,
        items: state.items,
        lastError: error instanceof Error ? error.message : "PAYMENT_ERROR",
      });
      void recordPendingFailure("PAYMENT_ERROR", error, { localOrderId });
      throw error;
    }
  },
}));
