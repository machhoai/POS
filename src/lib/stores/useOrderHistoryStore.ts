import { create } from "zustand";
import { fetchOrderHistory } from "@/lib/services/orderService";
import type { PosOrder } from "@/lib/types/order";

interface OrderHistoryState {
  orders: PosOrder[];
  isLoading: boolean;
  error: string | null;
  fetchedAt: string | null;
  fetchOrders: () => Promise<void>;
}

export const useOrderHistoryStore = create<OrderHistoryState>((set) => ({
  orders: [],
  isLoading: false,
  error: null,
  fetchedAt: null,

  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await fetchOrderHistory();
      set({
        orders: result.orders,
        isLoading: false,
        error: null,
        fetchedAt: result.fetchedAt,
      });
    } catch (error: unknown) {
      console.error("[Lịch sử đơn] Không thể tải đơn hàng:", error);
      set({
        isLoading: false,
        error: "Không thể tải lịch sử đơn hàng. Vui lòng thử lại.",
      });
      throw error;
    }
  },
}));
