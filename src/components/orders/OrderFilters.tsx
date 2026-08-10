"use client";

// =============================================================================
// OrderFilters — Bộ lọc đơn hàng trong ngày hôm nay
// =============================================================================

export interface OrderFilterState {
    searchQuery: string;
    sortBy: "newest" | "oldest" | "highest" | "lowest";
    statusFilter: string;
}

interface OrderFiltersProps {
    filters: OrderFilterState;
    onChange: (filters: OrderFilterState) => void;
}

export const DEFAULT_FILTERS: OrderFilterState = {
    searchQuery: "",
    sortBy: "newest",
    statusFilter: "all",
};

const STATUS_TABS = [
    { id: "all", label: "Tất cả" },
    { id: "SYNC_SUCCESS", label: "Đã đồng bộ" },
    { id: "LOCAL_PAID", label: "Chờ đồng bộ" },
    { id: "SYNCING", label: "Đang đồng bộ" },
    { id: "SYNC_FAILED", label: "Lỗi đồng bộ" },
];

const OrderFilters: React.FC<OrderFiltersProps> = ({ filters, onChange }) => {
    const update = (partial: Partial<OrderFilterState>) => {
        onChange({ ...filters, ...partial });
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <label className="whitespace-nowrap text-xs font-semibold text-[var(--color-text-muted)]">
                        Trạng thái:
                    </label>
                    <select
                        value={filters.statusFilter}
                        onChange={(event) => update({ statusFilter: event.target.value })}
                        className="min-h-10 cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition-colors focus:border-[var(--color-accent)] md:text-sm"
                    >
                        {STATUS_TABS.map((tab) => (
                            <option key={tab.id} value={tab.id}>
                                {tab.label}
                            </option>
                        ))}
                    </select>
                </div>

                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-orange-500/10 px-3 text-xs font-bold text-[var(--color-accent)]">
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 9.75h16.5m-15-4.5h13.5A1.5 1.5 0 0 1 20.25 6.75v12a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-12a1.5 1.5 0 0 1 1.5-1.5Z" />
                    </svg>
                    Chỉ hiển thị đơn hôm nay
                </span>
            </div>

            <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative flex items-center">
                    <svg
                        className="pointer-events-none absolute left-3.5 size-4 text-[var(--color-text-muted)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                        type="search"
                        value={filters.searchQuery}
                        onChange={(event) => update({ searchQuery: event.target.value })}
                        placeholder="Tìm đơn hôm nay theo mã đơn, sản phẩm, khách hàng, SĐT..."
                        aria-label="Tìm đơn hàng hôm nay"
                        className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-10 pr-3 text-xs text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] md:text-sm"
                    />
                </div>

                <select
                    value={filters.sortBy}
                    onChange={(event) => update({ sortBy: event.target.value as OrderFilterState["sortBy"] })}
                    aria-label="Sắp xếp đơn hàng"
                    className="min-h-10 cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text-primary)]"
                >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="highest">Giá giảm dần</option>
                    <option value="lowest">Giá tăng dần</option>
                </select>
            </div>
        </div>
    );
};

export default OrderFilters;
