"use client";

// =============================================================================
// Trang Lịch sử Đơn hàng — /orders
// =============================================================================

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { MOCK_ORDERS } from "@/lib/data/mockOrders";
import type { PosOrder } from "@/lib/types/order";
import Sidebar from "@/components/layout/Sidebar";
import OrderFilters, { DEFAULT_FILTERS, type OrderFilterState } from "@/components/orders/OrderFilters";
import OrderTable from "@/components/orders/OrderTable";
import OrderDetailModal from "@/components/orders/OrderDetailModal";
import { formatCurrency } from "@/lib/utils/formatCurrency";

export default function OrderHistoryPage() {
    const router = useRouter();
    const { user, userDoc, isLoading: authLoading, logout } = useAuth();
    const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_FILTERS);
    const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);

    // Auth guard
    useEffect(() => {
        if (!authLoading && (!user || !userDoc)) {
            router.replace("/login");
        }
    }, [authLoading, user, userDoc, router]);

    // Filter + Sort logic
    const filteredOrders = useMemo(() => {
        let result = [...MOCK_ORDERS];

        // Filter by date range
        if (filters.dateFrom) {
            const from = new Date(filters.dateFrom);
            from.setHours(0, 0, 0, 0);
            result = result.filter((o) => new Date(o.createdAt) >= from);
        }
        if (filters.dateTo) {
            const to = new Date(filters.dateTo);
            to.setHours(23, 59, 59, 999);
            result = result.filter((o) => new Date(o.createdAt) <= to);
        }

        // Filter by hour range
        if (filters.hourFrom) {
            const [h, m] = filters.hourFrom.split(":").map(Number);
            result = result.filter((o) => {
                const d = new Date(o.createdAt);
                return d.getHours() > h || (d.getHours() === h && d.getMinutes() >= m);
            });
        }
        if (filters.hourTo) {
            const [h, m] = filters.hourTo.split(":").map(Number);
            result = result.filter((o) => {
                const d = new Date(o.createdAt);
                return d.getHours() < h || (d.getHours() === h && d.getMinutes() <= m);
            });
        }

        // Filter by status
        if (filters.statusFilter !== "all") {
            result = result.filter((o) => o.status === filters.statusFilter);
        }

        // Search
        if (filters.searchQuery.trim()) {
            const q = filters.searchQuery.toLowerCase().trim();
            result = result.filter((o) =>
                o.localOrderId.toLowerCase().includes(q) ||
                o.items.some((i) => i.goodsName.toLowerCase().includes(q)) ||
                (o.customerName?.toLowerCase().includes(q)) ||
                (o.customerPhone?.includes(q))
            );
        }

        // Sort
        switch (filters.sortBy) {
            case "newest":
                result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
            case "oldest":
                result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                break;
            case "highest":
                result.sort((a, b) => b.totalAmount - a.totalAmount);
                break;
            case "lowest":
                result.sort((a, b) => a.totalAmount - b.totalAmount);
                break;
        }

        return result;
    }, [filters]);

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
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Lịch sử đơn hàng</h1>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                {filteredOrders.length} đơn · Doanh thu: {formatCurrency(totalRevenue)} · Đã đồng bộ: {successCount}
                            </p>
                        </div>
                    </div>
                </header>

                {/* Filters */}
                <div className="px-6 py-3 border-b border-[var(--color-border)] shrink-0">
                    <OrderFilters filters={filters} onChange={setFilters} />
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                    <OrderTable orders={filteredOrders} onSelectOrder={setSelectedOrder} />
                </div>
            </main>

            {/* Detail Modal */}
            {selectedOrder && (
                <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
            )}
        </div>
    );
}
