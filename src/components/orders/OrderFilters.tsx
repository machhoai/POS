"use client";

// =============================================================================
// OrderFilters — Bộ lọc đơn hàng nâng cao
// =============================================================================

import { useState } from "react";

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

const STATUS_TABS = [
    { id: "all", label: "Tất cả" },
    { id: "SYNC_SUCCESS", label: "Đã đồng bộ", color: "bg-emerald-500" },
    { id: "LOCAL_PAID", label: "Chờ đồng bộ", color: "bg-amber-500" },
    { id: "SYNCING", label: "Đang đồng bộ", color: "bg-blue-500" },
    { id: "SYNC_FAILED", label: "Lỗi đồng bộ", color: "bg-red-500" },
];

export default function OrderFilters({ filters, onChange }: OrderFiltersProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);

    const update = (partial: Partial<OrderFilterState>) =>
        onChange({ ...filters, ...partial });

    const getTodayStr = () => new Date().toISOString().split("T")[0];

    const handlePresetDate = (preset: "today" | "yesterday" | "week7" | "all") => {
        const today = new Date();
        const todayStr = getTodayStr();

        if (preset === "today") {
            update({ dateFrom: todayStr, dateTo: todayStr });
        } else if (preset === "yesterday") {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            const yStr = y.toISOString().split("T")[0];
            update({ dateFrom: yStr, dateTo: yStr });
        } else if (preset === "week7") {
            const w = new Date(today);
            w.setDate(w.getDate() - 7);
            const wStr = w.toISOString().split("T")[0];
            update({ dateFrom: wStr, dateTo: todayStr });
        } else if (preset === "all") {
            update({ dateFrom: "", dateTo: "" });
        }
    };

    const isToday = filters.dateFrom === getTodayStr() && filters.dateTo === getTodayStr();
    const isNoDate = !filters.dateFrom && !filters.dateTo;

    return (
        <div className="space-y-3">
            {/* Dropdown Trạng thái đơn hàng */}
            <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">
                    Trạng thái:
                </label>
                <select
                    value={filters.statusFilter}
                    onChange={(e) => update({ statusFilter: e.target.value })}
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs md:text-sm font-semibold text-[var(--color-text-primary)] min-h-[40px] cursor-pointer focus:border-[var(--color-accent)] transition-colors"
                >
                    {STATUS_TABS.map((tab) => (
                        <option key={tab.id} value={tab.id}>
                            {tab.label}
                        </option>
                    ))}
                </select>
            </div>


            {/* Hàng 2: Tìm kiếm + Sort + Preset Ngày + Toggle Nâng cao */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                {/* Search Bar */}
                <div className="relative md:col-span-6 flex items-center">
                    <svg
                        className="absolute left-3.5 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none"
                        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                        type="text"
                        value={filters.searchQuery}
                        onChange={(e) => update({ searchQuery: e.target.value })}
                        placeholder="Tìm theo mã đơn, tên SP, khách hàng, SĐT..."
                        className="w-full pl-10 pr-9 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs md:text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent)] transition-colors min-h-[40px]"
                    />
                    {filters.searchQuery && (
                        <button
                            type="button"
                            onClick={() => update({ searchQuery: "" })}
                            className="absolute right-3 w-4 h-4 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center text-xs font-bold"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Quick Date Presets */}
                <div className="md:col-span-4 flex items-center gap-1 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => handlePresetDate("today")}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                            isToday
                                ? "bg-orange-500/10 text-[var(--color-accent)] border-orange-500/30 font-semibold"
                                : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                        }`}
                    >
                        Hôm nay
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePresetDate("yesterday")}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                        Hôm qua
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePresetDate("week7")}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                        7 ngày qua
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePresetDate("all")}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                            isNoDate
                                ? "bg-orange-500/10 text-[var(--color-accent)] border-orange-500/30 font-semibold"
                                : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                        }`}
                    >
                        Tất cả ngày
                    </button>
                </div>

                {/* Sort & Advanced Toggle */}
                <div className="md:col-span-2 flex items-center gap-1.5 justify-end">
                    <select
                        value={filters.sortBy}
                        onChange={(e) => update({ sortBy: e.target.value as OrderFilterState["sortBy"] })}
                        className="px-2.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text-primary)] min-h-[40px] font-medium cursor-pointer"
                    >
                        <option value="newest">Mới nhất</option>
                        <option value="oldest">Cũ nhất</option>
                        <option value="highest">Giá ↓</option>
                        <option value="lowest">Giá ↑</option>
                    </select>

                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`p-2 rounded-xl border border-[var(--color-border)] transition-colors min-h-[40px] flex items-center justify-center ${
                            showAdvanced || filters.hourFrom || filters.hourTo
                                ? "bg-orange-500/10 text-[var(--color-accent)] border-orange-500/30"
                                : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                        }`}
                        title="Bộ lọc thời gian chi tiết"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Advanced Time Picker Panel */}
            {showAdvanced && (
                <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl flex flex-wrap items-center gap-3 animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[var(--color-text-muted)] font-medium">Từ ngày:</span>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => update({ dateFrom: e.target.value })}
                            className="px-2.5 py-1.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-primary)]"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[var(--color-text-muted)] font-medium">Đến ngày:</span>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => update({ dateTo: e.target.value })}
                            className="px-2.5 py-1.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-primary)]"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[var(--color-text-muted)] font-medium">Khung giờ:</span>
                        <input
                            type="time"
                            value={filters.hourFrom}
                            onChange={(e) => update({ hourFrom: e.target.value })}
                            className="px-2.5 py-1.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-primary)]"
                        />
                        <span className="text-xs text-[var(--color-text-muted)]">→</span>
                        <input
                            type="time"
                            value={filters.hourTo}
                            onChange={(e) => update({ hourTo: e.target.value })}
                            className="px-2.5 py-1.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-primary)]"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => update({ dateFrom: "", dateTo: "", hourFrom: "", hourTo: "" })}
                        className="ml-auto text-xs text-red-500 hover:underline font-medium"
                    >
                        Xóa mốc giờ
                    </button>
                </div>
            )}
        </div>
    );
}
