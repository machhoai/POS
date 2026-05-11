"use client";

// =============================================================================
// OrderDetailModal — Chi tiết đơn hàng đầy đủ
// =============================================================================

import type { PosOrder } from "@/lib/types/order";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface OrderDetailModalProps {
    order: PosOrder;
    onClose: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    SYNC_SUCCESS: { label: "Đã đồng bộ", color: "text-emerald-400" },
    LOCAL_PAID: { label: "Chờ đồng bộ", color: "text-amber-400" },
    SYNCING: { label: "Đang đồng bộ", color: "text-blue-400" },
    SYNC_FAILED: { label: "Lỗi đồng bộ", color: "text-red-400" },
    DRAFT: { label: "Nháp", color: "text-gray-400" },
};

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

export default function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
    const status = STATUS_LABELS[order.status] || STATUS_LABELS.DRAFT;
    const finalAmount = order.totalAmount - (order.voucherDiscount || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-[var(--color-text-primary)]">Chi tiết đơn hàng</h2>
                        <code className="text-xs text-[var(--color-text-muted)] font-mono">{order.localOrderId}</code>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] transition-colors"
                    >
                        <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Thông tin chung */}
                    <div className="grid grid-cols-2 gap-3">
                        <InfoRow label="Trạng thái" value={status.label} className={status.color} />
                        <InfoRow label="Thời gian" value={formatDateTime(order.createdAt)} />
                        <InfoRow label="Thanh toán" value={order.paymentMethod === "CASH" ? "💵 Tiền mặt" : "📱 QR Code"} />
                        <InfoRow label="Mã HK" value={order.hkOrderNumber || "—"} />
                    </div>

                    {/* Khách hàng */}
                    {order.customerName && (
                        <div className="p-3 bg-[var(--color-surface-hover)] rounded-xl space-y-1">
                            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Khách hàng</p>
                            <p className="text-sm text-[var(--color-text-primary)]">{order.customerName}</p>
                            {order.customerPhone && (
                                <p className="text-xs text-[var(--color-text-muted)]">📞 {order.customerPhone}</p>
                            )}
                        </div>
                    )}

                    {/* Danh sách sản phẩm */}
                    <div>
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2">Sản phẩm</p>
                        <ul className="space-y-2">
                            {order.items.map((item, idx) => (
                                <li key={idx} className="flex items-center justify-between py-2 px-3 bg-[var(--color-surface-hover)] rounded-xl">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-[var(--color-text-primary)] truncate">{item.goodsName}</p>
                                        <p className="text-xs text-[var(--color-text-muted)]">{formatCurrency(item.price)} × {item.quantity}</p>
                                    </div>
                                    <span className="text-sm font-semibold text-[var(--color-accent)] ml-3">
                                        {formatCurrency(item.price * item.quantity)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Voucher */}
                    {order.voucherCode && (
                        <div className="flex items-center justify-between p-3 bg-amber-900/15 border border-amber-700/20 rounded-xl">
                            <div>
                                <p className="text-xs font-medium text-amber-300">Voucher: {order.voucherCode}</p>
                            </div>
                            <span className="text-sm font-medium text-amber-400">
                                -{formatCurrency(order.voucherDiscount || 0)}
                            </span>
                        </div>
                    )}

                    {/* Sync info */}
                    <div className="p-3 bg-[var(--color-surface-hover)] rounded-xl space-y-1">
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Đồng bộ</p>
                        <InfoRow label="Lần thử" value={String(order.sync.retryCount)} />
                        {order.sync.syncedAt && <InfoRow label="Thời điểm" value={formatDateTime(order.sync.syncedAt)} />}
                        {order.sync.lastError && <InfoRow label="Lỗi" value={order.sync.lastError} className="text-red-400" />}
                    </div>
                </div>

                {/* Footer — Tổng tiền */}
                <div className="px-5 py-4 border-t border-[var(--color-border)] shrink-0 space-y-1">
                    <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                        <span>Tạm tính</span>
                        <span>{formatCurrency(order.totalAmount)}</span>
                    </div>
                    {order.voucherDiscount && (
                        <div className="flex justify-between text-sm text-amber-400">
                            <span>Giảm giá</span>
                            <span>-{formatCurrency(order.voucherDiscount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-[var(--color-border)]">
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">Tổng cộng</span>
                        <span className="text-xl font-bold text-[var(--color-accent)]">{formatCurrency(finalAmount)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
    return (
        <div>
            <p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
            <p className={`text-sm font-medium ${className || "text-[var(--color-text-primary)]"}`}>{value}</p>
        </div>
    );
}
