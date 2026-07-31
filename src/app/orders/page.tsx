"use client";

// =============================================================================
// Trang Lịch sử Đơn hàng — /orders
// =============================================================================

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrderHistoryStore } from "@/lib/stores/useOrderHistoryStore";
import type { PosOrder } from "@/lib/types/order";
import Sidebar from "@/components/layout/Sidebar";
import OrderFilters, { DEFAULT_FILTERS, type OrderFilterState } from "@/components/orders/OrderFilters";
import OrderTable from "@/components/orders/OrderTable";
import OrderDetailModal from "@/components/orders/OrderDetailModal";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { filterAndSortOrders } from "@/lib/utils/filterOrders";
import { retryOrderSync } from "@/lib/services/orderService";
import { showError, showPromise } from "@/lib/utils/toast";

const EMPTY_ORDERS: PosOrder[] = [];

export default function OrderHistoryPage() {
    const router = useRouter();
    const { user, userDoc, isLoading: authLoading, logout } = useAuth();
    const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_FILTERS);
    const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);
    // Zustand can preserve the previous store shape during development HMR.
    const orders = useOrderHistoryStore((state) =>
        Array.isArray(state.orders) ? state.orders : EMPTY_ORDERS
    );
    const isLoadingOrders = useOrderHistoryStore((state) => state.isLoading);
    const orderError = useOrderHistoryStore((state) => state.error);
    const fetchOrders = useOrderHistoryStore((state) => state.fetchOrders);

    // Auth guard
    useEffect(() => {
        if (!authLoading && (!user || !userDoc)) {
            router.replace("/login");
        }
    }, [authLoading, user, userDoc, router]);

    useEffect(() => {
        if (!user || !userDoc) return;
        void fetchOrders().catch(() => {
            showError(
                "Không thể tải lịch sử đơn",
                "Vui lòng kiểm tra kết nối và thử lại.",
            );
        });
    }, [user, userDoc, fetchOrders]);

    const filteredOrders = useMemo(
        () => filterAndSortOrders(orders, filters),
        [filters, orders],
    );

    const handleRetrySync = useCallback(async () => {
        if (!selectedOrder) return;
        setIsRetrying(true);
        try {
            await showPromise(retryOrderSync(selectedOrder.localOrderId), {
                loading: "Đang xếp lại đơn...",
                success: "Đã xếp lại đơn",
                error: "Không thể đồng bộ lại",
                successDescription: "Hệ thống sẽ tiếp tục thanh toán đơn ở chế độ nền.",
                errorDescription: "Vui lòng kiểm tra cấu hình thanh toán và thử lại.",
            });
            await fetchOrders();
            setSelectedOrder(null);
        } catch (error: unknown) {
            console.error("[Lịch sử đơn] Không thể đồng bộ lại:", error);
        } finally {
            setIsRetrying(false);
        }
    }, [selectedOrder, fetchOrders]);

    // Stats
    const totalRevenue = filteredOrders.reduce((s, o) => s + o.totalAmount, 0);
    const successCount = filteredOrders.filter((o) => o.status === "SYNC_SUCCESS").length;

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
                <div className="animate-pulse text-[var(--color-text-muted)]">Đang tải...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[var(--color-background)]">
            <Sidebar onLogout={logout} />

            <main className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="px-6 py-4 border-b border-[var(--color-border)] shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Lịch sử đơn hàng</h1>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                {filteredOrders.length} đơn · Doanh thu: {formatCurrency(totalRevenue)} · Đã đồng bộ: {successCount}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void fetchOrders()}
                            disabled={isLoadingOrders}
                            className="min-h-11 touch-manipulation rounded-xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-[var(--color-text-primary)] transition-colors hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50"
                        >
                            {isLoadingOrders ? "Đang tải..." : "Làm mới"}
                        </button>
                    </div>
                </header>

                {/* Filters */}
                <div className="px-6 py-3 border-b border-[var(--color-border)] shrink-0">
                    <OrderFilters filters={filters} onChange={setFilters} />
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                    {isLoadingOrders && orders.length === 0 ? (
                        <div className="flex h-48 items-center justify-center text-sm text-[var(--color-text-muted)]">
                            Đang tải lịch sử đơn hàng...
                        </div>
                    ) : orderError && orders.length === 0 ? (
                        <div className="flex h-48 items-center justify-center text-sm text-red-500">
                            {orderError}
                        </div>
                    ) : (
                        <OrderTable orders={filteredOrders} onSelectOrder={setSelectedOrder} />
                    )}
                </div>
            </main>

            {/* Detail Modal */}
            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    isRetrying={isRetrying}
                    onRetrySync={handleRetrySync}
                    onClose={() => setSelectedOrder(null)}
                />
            )}
        </div>
    );
}
