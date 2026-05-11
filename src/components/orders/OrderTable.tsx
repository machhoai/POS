"use client";

// =============================================================================
// OrderTable — Bảng danh sách đơn hàng
// =============================================================================

import type { PosOrder } from "@/lib/types/order";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface OrderTableProps {
    orders: PosOrder[];
    onSelectOrder: (order: PosOrder) => void;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
    SYNC_SUCCESS: { label: "Đã đồng bộ", className: "bg-emerald-500/15 text-emerald-400" },
    LOCAL_PAID: { label: "Chờ đồng bộ", className: "bg-amber-500/15 text-amber-400" },
    SYNCING: { label: "Đang đồng bộ", className: "bg-blue-500/15 text-blue-400" },
    SYNC_FAILED: { label: "Lỗi", className: "bg-red-500/15 text-red-400" },
    DRAFT: { label: "Nháp", className: "bg-gray-500/15 text-gray-400" },
};

function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function OrderTable({ orders, onSelectOrder }: OrderTableProps) {
    if (orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--color-text-muted)]">
                <svg className="w-14 h-14 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                </svg>
                <p className="text-sm">Không tìm thấy đơn hàng</p>
                <p className="text-xs mt-1 opacity-60">Thử thay đổi bộ lọc</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b border-[var(--color-border)]">
                        <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Mã đơn</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Thời gian</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Khách hàng</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Sản phẩm</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">PTTT</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase text-right">Tổng tiền</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase text-center">Trạng thái</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                    {orders.map((order) => {
                        const status = STATUS_MAP[order.status] || STATUS_MAP.DRAFT;
                        const itemNames = order.items.map((i) => i.goodsName).join(", ");
                        const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

                        return (
                            <tr
                                key={order.localOrderId}
                                onClick={() => onSelectOrder(order)}
                                className="hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] cursor-pointer transition-colors"
                            >
                                <td className="px-4 py-3.5">
                                    <code className="text-xs font-mono text-[var(--color-text-primary)]">
                                        {order.localOrderId.split("-").pop()}
                                    </code>
                                </td>
                                <td className="px-4 py-3.5">
                                    <p className="text-sm text-[var(--color-text-primary)]">{formatTime(order.createdAt)}</p>
                                    <p className="text-[11px] text-[var(--color-text-muted)]">{formatDate(order.createdAt)}</p>
                                </td>
                                <td className="px-4 py-3.5">
                                    {order.customerName ? (
                                        <div>
                                            <p className="text-sm text-[var(--color-text-primary)]">{order.customerName}</p>
                                            <p className="text-[11px] text-[var(--color-text-muted)]">{order.customerPhone}</p>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-[var(--color-text-muted)] italic">Khách vãng lai</span>
                                    )}
                                </td>
                                <td className="px-4 py-3.5 max-w-[200px]">
                                    <p className="text-sm text-[var(--color-text-primary)] truncate">{itemNames}</p>
                                    <p className="text-[11px] text-[var(--color-text-muted)]">{totalQty} sản phẩm</p>
                                </td>
                                <td className="px-4 py-3.5">
                                    <span className="text-xs text-[var(--color-text-secondary)]">
                                        {order.paymentMethod === "CASH" ? "💵 Tiền mặt" : "📱 QR"}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                    <span className="text-sm font-bold text-[var(--color-accent)]">
                                        {formatCurrency(order.totalAmount)}
                                    </span>
                                    {order.voucherDiscount && (
                                        <p className="text-[10px] text-amber-400">-{formatCurrency(order.voucherDiscount)}</p>
                                    )}
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                    <span className={`inline-block px-2.5 py-1 text-[11px] font-medium rounded-lg ${status.className}`}>
                                        {status.label}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
