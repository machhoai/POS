"use client";

// =============================================================================
// OrderFilters — Bộ lọc đơn hàng: ngày, giờ, tìm kiếm, sắp xếp
// =============================================================================

export interface OrderFilterState {
    dateFrom: string;
    dateTo: string;
    hourFrom: string;
    hourTo: string;
    searchQuery: string;
    sortBy: "newest" | "oldest" | "highest" | "lowest";
    statusFilter: string;
}

interface OrderFiltersProps {
    filters: OrderFilterState;
    onChange: (filters: OrderFilterState) => void;
}

export const DEFAULT_FILTERS: OrderFilterState = {
    dateFrom: new Date().toISOString().split("T")[0],
    dateTo: new Date().toISOString().split("T")[0],
    hourFrom: "",
    hourTo: "",
    searchQuery: "",
    sortBy: "newest",
    statusFilter: "all",
};

export default function OrderFilters({ filters, onChange }: OrderFiltersProps) {
    const update = (partial: Partial<OrderFilterState>) =>
        onChange({ ...filters, ...partial });

    return (
        <div className="space-y-3">
            {/* Hàng 1: Ngày + Giờ */}
            <div className="flex flex-wrap gap-2">
                {/* Từ ngày */}
                <div className="flex items-center gap-1.5">
                    <label className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">Từ</label>
                    <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => update({ dateFrom: e.target.value })}
                        className="px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm min-h-[44px] text-[var(--color-text-primary)]"
                    />
                </div>
                {/* Đến ngày */}
                <div className="flex items-center gap-1.5">
                    <label className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">Đến</label>
                    <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => update({ dateTo: e.target.value })}
                        className="px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm min-h-[44px] text-[var(--color-text-primary)]"
                    />
                </div>
                {/* Giờ bắt đầu */}
                <div className="flex items-center gap-1.5">
                    <label className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">Giờ</label>
                    <input
                        type="time"
                        value={filters.hourFrom}
                        onChange={(e) => update({ hourFrom: e.target.value })}
                        className="px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm min-h-[44px] text-[var(--color-text-primary)]"
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    <label className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">→</label>
                    <input
                        type="time"
                        value={filters.hourTo}
                        onChange={(e) => update({ hourTo: e.target.value })}
                        className="px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm min-h-[44px] text-[var(--color-text-primary)]"
                    />
                </div>
            </div>

            {/* Hàng 2: Tìm kiếm + Sort + Status */}
            <div className="flex flex-wrap gap-2">
                {/* Tìm kiếm */}
                <div className="relative flex-1 min-w-[200px]">
                    <svg
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
                        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                        type="text"
                        value={filters.searchQuery}
                        onChange={(e) => update({ searchQuery: e.target.value })}
                        placeholder="Tìm theo tên SP, SĐT, tên KH, mã đơn..."
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm min-h-[44px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
                    />
                </div>

                {/* Sắp xếp */}
                <select
                    value={filters.sortBy}
                    onChange={(e) => update({ sortBy: e.target.value as OrderFilterState["sortBy"] })}
                    className="px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm min-h-[44px] text-[var(--color-text-primary)]"
                >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="highest">Giá cao → thấp</option>
                    <option value="lowest">Giá thấp → cao</option>
                </select>

                {/* Trạng thái */}
                <select
                    value={filters.statusFilter}
                    onChange={(e) => update({ statusFilter: e.target.value })}
                    className="px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm min-h-[44px] text-[var(--color-text-primary)]"
                >
                    <option value="all">Tất cả TT</option>
                    <option value="SYNC_SUCCESS">Đã đồng bộ</option>
                    <option value="LOCAL_PAID">Chờ đồng bộ</option>
                    <option value="SYNCING">Đang đồng bộ</option>
                    <option value="SYNC_FAILED">Lỗi đồng bộ</option>
                </select>
            </div>
        </div>
    );
}
