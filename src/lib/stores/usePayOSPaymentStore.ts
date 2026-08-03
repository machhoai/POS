import { create } from "zustand";
import { fetchOrderSyncStatus } from "@/lib/services/orderService";
import {
  cancelPayOSPayment,
  confirmPayOSPaymentManually,
  createPayOSPayment,
  fetchPayOSPaymentStatus,
  handlePayOSPaymentTimeout,
  recreatePayOSPayment,
  resumePayOSPayment,
  type CreatePayOSPaymentInput,
} from "@/lib/services/payOSService";
import type {
  OrderStatus,
  PayOSManualConfirmation,
} from "@/lib/types/order";
import type {
  PayOSErrorKind,
  PayOSNextAction,
  PayOSPaymentResult,
  PayOSPaymentSession,
} from "@/lib/types/payment";

interface PayOSPaymentState {
  localOrderId: string | null;
  orderStatus: OrderStatus | null;
  session: PayOSPaymentSession | null;
  nextAction: PayOSNextAction | null;
  remainingSeconds: number;
  serverClockOffsetMs: number;
  isCreating: boolean;
  isChecking: boolean;
  isFallbackChecking: boolean;
  isPolling: boolean;
  error: string | null;
  errorKind: PayOSErrorKind | null;
  manualConfirmation: PayOSManualConfirmation | null;
  startPayment: (input: CreatePayOSPaymentInput) => Promise<PayOSPaymentResult>;
  refreshPayment: () => Promise<PayOSPaymentResult | null>;
  fallbackCheck: () => Promise<void>;
  checkOrderCompletion: () => Promise<boolean>;
  handleDisplayTimeout: () => Promise<PayOSPaymentResult | null>;
  retryDisplay: () => Promise<PayOSPaymentResult | null>;
  recreatePayment: () => Promise<PayOSPaymentResult | null>;
  cancelPayment: () => Promise<PayOSPaymentResult | null>;
  confirmManually: () => Promise<PayOSPaymentResult | null>;
  updateRemainingSeconds: (nowMs?: number) => void;
  resetPayment: () => void;
}

const completedStatuses: ReadonlySet<OrderStatus> = new Set([
  "LOCAL_PAID",
  "SYNCING",
  "SYNC_SUCCESS",
  "SYNC_FAILED",
]);

const initialState = {
  localOrderId: null,
  orderStatus: null,
  session: null,
  nextAction: null,
  remainingSeconds: 0,
  serverClockOffsetMs: 0,
  isCreating: false,
  isChecking: false,
  isFallbackChecking: false,
  isPolling: false,
  error: null,
  errorKind: null,
  manualConfirmation: null,
} satisfies Pick<
  PayOSPaymentState,
  | "localOrderId"
  | "orderStatus"
  | "session"
  | "nextAction"
  | "remainingSeconds"
  | "serverClockOffsetMs"
  | "isCreating"
  | "isChecking"
  | "isFallbackChecking"
  | "isPolling"
  | "error"
  | "errorKind"
  | "manualConfirmation"
>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Không thể xử lý thanh toán PayOS. Vui lòng thử lại.";
}

function getErrorKind(error: unknown): PayOSErrorKind {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  return [
    "functions/unavailable",
    "functions/deadline-exceeded",
    "auth/network-request-failed",
  ].includes(code)
    ? "CONNECTION"
    : "GENERAL";
}

function resultState(result: PayOSPaymentResult, receivedAtMs = Date.now()) {
  const serverTimeMs = Date.parse(result.serverTime);
  const serverClockOffsetMs = Number.isFinite(serverTimeMs)
    ? serverTimeMs - receivedAtMs
    : 0;
  const displayExpiresAtMs = result.payment
    ? Date.parse(result.payment.displayExpiresAt)
    : 0;
  const remainingSeconds = result.nextAction === "WAIT"
    ? Math.max(
      0,
      Math.ceil(
        (displayExpiresAtMs - (receivedAtMs + serverClockOffsetMs)) / 1000,
      ),
    )
    : 0;

  return {
    localOrderId: result.localOrderId,
    orderStatus: result.orderStatus,
    session: result.payment,
    nextAction: result.nextAction,
    remainingSeconds,
    serverClockOffsetMs,
    error: null,
    errorKind: null,
    manualConfirmation: result.manualConfirmation,
  };
}

export const usePayOSPaymentStore = create<PayOSPaymentState>((set, get) => ({
  ...initialState,

  startPayment: async (input) => {
    set({
      localOrderId: input.localOrderId,
      isCreating: true,
      error: null,
      errorKind: null,
    });
    try {
      const result = await createPayOSPayment(input);
      set({ ...resultState(result), isCreating: false });
      return result;
    } catch (error: unknown) {
      console.error("[PayOS] Không thể tạo mã thanh toán:", error);
      set({
        isCreating: false,
        error: getErrorMessage(error),
        errorKind: getErrorKind(error),
      });
      throw error;
    }
  },

  refreshPayment: async () => {
    const localOrderId = get().localOrderId;
    if (!localOrderId || get().isChecking || get().isFallbackChecking) {
      return null;
    }
    set({ isChecking: true, error: null, errorKind: null });
    try {
      const result = await fetchPayOSPaymentStatus(localOrderId);
      set({ ...resultState(result), isChecking: false });
      return result;
    } catch (error: unknown) {
      console.error("[PayOS] Không thể cập nhật trạng thái thanh toán:", error);
      set({
        isChecking: false,
        error: getErrorMessage(error),
        errorKind: getErrorKind(error),
      });
      throw error;
    }
  },

  fallbackCheck: async () => {
    const { localOrderId, isChecking, isFallbackChecking, nextAction } = get();
    if (
      !localOrderId ||
      isChecking ||
      isFallbackChecking ||
      nextAction !== "WAIT"
    ) return;
    set({ isFallbackChecking: true });
    try {
      const result = await fetchPayOSPaymentStatus(localOrderId);
      if (get().localOrderId === localOrderId) {
        set({ ...resultState(result), isFallbackChecking: false });
      }
    } catch (error: unknown) {
      console.error("[PayOS] Kiểm tra dự phòng định kỳ thất bại:", error);
      if (get().localOrderId === localOrderId) {
        set({ isFallbackChecking: false });
      }
    }
  },

  checkOrderCompletion: async () => {
    const localOrderId = get().localOrderId;
    if (!localOrderId || get().isPolling) return false;
    set({ isPolling: true });
    try {
      const order = await fetchOrderSyncStatus(localOrderId);
      if (get().localOrderId !== localOrderId) {
        set({ isPolling: false });
        return false;
      }
      const completed = completedStatuses.has(order.status);
      set({
        isPolling: false,
        orderStatus: order.status,
        ...(completed
          ? { nextAction: "COMPLETED" as const, remainingSeconds: 0 }
          : {}),
      });
      return completed;
    } catch (error: unknown) {
      console.error("[PayOS] Không thể theo dõi trạng thái đơn hàng:", error);
      set({ isPolling: false });
      return false;
    }
  },

  handleDisplayTimeout: async () => {
    const localOrderId = get().localOrderId;
    if (!localOrderId || get().isChecking) return null;
    set({
      isChecking: true,
      remainingSeconds: 0,
      error: null,
      errorKind: null,
    });
    try {
      const result = await handlePayOSPaymentTimeout(localOrderId);
      set({ ...resultState(result), isChecking: false });
      return result;
    } catch (error: unknown) {
      console.error("[PayOS] Không thể kiểm tra khi hết lượt hiển thị:", error);
      set({
        isChecking: false,
        error: getErrorMessage(error),
        errorKind: getErrorKind(error),
      });
      throw error;
    }
  },

  retryDisplay: async () => {
    const localOrderId = get().localOrderId;
    if (!localOrderId || get().isChecking) return null;
    set({ isChecking: true, error: null, errorKind: null });
    try {
      const result = await resumePayOSPayment(localOrderId);
      set({ ...resultState(result), isChecking: false });
      return result;
    } catch (error: unknown) {
      console.error("[PayOS] Không thể gia hạn lượt hiển thị:", error);
      set({
        isChecking: false,
        error: getErrorMessage(error),
        errorKind: getErrorKind(error),
      });
      throw error;
    }
  },

  recreatePayment: async () => {
    const localOrderId = get().localOrderId;
    if (!localOrderId || get().isCreating) return null;
    set({ isCreating: true, error: null, errorKind: null });
    try {
      const result = await recreatePayOSPayment(localOrderId);
      set({ ...resultState(result), isCreating: false });
      return result;
    } catch (error: unknown) {
      console.error("[PayOS] Không thể tạo lại mã thanh toán:", error);
      set({
        isCreating: false,
        error: getErrorMessage(error),
        errorKind: getErrorKind(error),
      });
      throw error;
    }
  },

  cancelPayment: async () => {
    const localOrderId = get().localOrderId;
    if (!localOrderId || get().isChecking) return null;
    set({ isChecking: true, error: null, errorKind: null });
    try {
      const result = await cancelPayOSPayment(localOrderId);
      set({ ...resultState(result), isChecking: false });
      return result;
    } catch (error: unknown) {
      console.error("[PayOS] Không thể hủy thanh toán:", error);
      set({
        isChecking: false,
        error: getErrorMessage(error),
        errorKind: getErrorKind(error),
      });
      throw error;
    }
  },

  confirmManually: async () => {
    const localOrderId = get().localOrderId;
    if (!localOrderId || get().isChecking) return null;
    set({ isChecking: true, error: null, errorKind: null });
    try {
      const result = await confirmPayOSPaymentManually(localOrderId);
      set({ ...resultState(result), isChecking: false });
      return result;
    } catch (error: unknown) {
      console.error("[PayOS] Không thể xác nhận chuyển khoản thủ công:", error);
      set({
        isChecking: false,
        error: getErrorMessage(error),
        errorKind: getErrorKind(error),
      });
      throw error;
    }
  },

  updateRemainingSeconds: (nowMs = Date.now()) => {
    const { session, nextAction, serverClockOffsetMs } = get();
    if (!session || nextAction !== "WAIT") {
      set({ remainingSeconds: 0 });
      return;
    }
    const remainingSeconds = Math.max(
      0,
      Math.ceil(
        (Date.parse(session.displayExpiresAt) -
          (nowMs + serverClockOffsetMs)) / 1000,
      ),
    );
    set({ remainingSeconds });
  },

  resetPayment: () => set(initialState),
}));
