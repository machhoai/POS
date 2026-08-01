"use client";

import { Gift, Ticket } from "lucide-react";
import { IoGift, IoTicket } from "react-icons/io5";

interface TopNavProps {
    storeName: string;
    cashierName: string;
    searchQuery: string;
    selectedCategory: number | null;
    onSearchChange: (query: string) => void;
    onSelectCategory: (category: 4 | 10) => void;
    onSyncProducts: () => void;
    isSyncing: boolean;
}

const CATEGORY_OPTIONS = [
    {
        id: 4,
        label: "Vé lượt",
        iconPath: "M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.38 5.25c-.62 0-1.13.5-1.13 1.13V9.4a3 3 0 0 1 0 5.2v3.03c0 .62.5 1.12 1.13 1.12h17.25c.62 0 1.12-.5 1.12-1.12V14.6a3 3 0 0 1 0-5.2V6.38c0-.62-.5-1.13-1.12-1.13H3.38Z",
    },
    {
        id: 10,
        label: "Sản phẩm lưu niệm",
        iconPath: "M21 8.25v10.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25m18 0A2.25 2.25 0 0 0 18.75 6H5.25A2.25 2.25 0 0 0 3 8.25m18 0V9A2.25 2.25 0 0 1 18.75 11.25H5.25A2.25 2.25 0 0 1 3 9v-.75m9-2.25v15m0-15H9.88a2.63 2.63 0 1 1 0-5.25C11.34.75 12 3 12 3s.66-2.25 2.13-2.25a2.63 2.63 0 1 1 0 5.25H12Z",
    },
] as const;

export default function TopNav({
    storeName,
    cashierName,
    searchQuery,
    selectedCategory,
    onSearchChange,
    onSelectCategory,
    onSyncProducts,
    isSyncing,
}: TopNavProps) {
    const firstName = cashierName.trim().split(/\s+/).at(-1) || cashierName;
    return (
        <header className="bg-[var(--color-background)] flex items-center gap-2 px-2 py-2 shrink-0">
            <div className="min-w-[190px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] mb-1">
                    {storeName}
                </p>
                <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
                    Xin chào, {firstName}!
                </h1>
            </div>

            <div className="relative flex-1 max-w-[460px] ml-auto">
                <svg
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--color-text-muted)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.2-5.2m0 0A7.5 7.5 0 1 0 5.2 5.2a7.5 7.5 0 0 0 10.6 10.6Z" />
                </svg>
                <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Tìm tên, nhóm hoặc mã vạch..."
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-transparent shadow-[var(--shadow-sm)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-orange-300 focus:ring-4 focus:ring-orange-100 transition-all"
                    aria-label="Tìm sản phẩm"
                />
            </div>

            <button
                type="button"
                onClick={onSyncProducts}
                disabled={isSyncing}
                className="w-12 h-12 rounded-xl bg-white border border-transparent shadow-[var(--shadow-sm)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-orange-200 disabled:opacity-50 transition-colors"
                title="Đồng bộ sản phẩm"
                aria-label="Đồng bộ sản phẩm"
            >
                <svg
                    className={`w-[18px] h-[18px] ${isSyncing ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.9}
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 9.35h5V4.36M3 19.64v-4.99h5m-4.99 0 3.18 3.18A8.25 8.25 0 0 0 20 14.14M4 9.86A8.25 8.25 0 0 1 17.8 6.17L21 9.35" />
                </svg>
            </button>

            <div
                className="h-12 shrink-0 flex items-center gap-1 rounded-xl bg-white p-1 shadow-[var(--shadow-sm)]"
                role="group"
                aria-label="Chọn loại sản phẩm"
            >
                {CATEGORY_OPTIONS.map((category) => {
                    const isActive = selectedCategory === category.id;

                    return (
                        <button
                            type="button"
                            key={category.id}
                            onClick={() => onSelectCategory(category.id)}
                            aria-pressed={isActive}
                            className={`h-10 px-3 flex items-center gap-2 rounded-lg whitespace-nowrap text-xs font-semibold transition-colors ${isActive
                                ? "bg-[var(--color-accent)] text-white shadow-sm"
                                : "text-[var(--color-text-secondary)] hover:bg-orange-50 hover:text-[var(--color-accent)]"
                                }`}
                        >
                            {category.id === 4 ? <IoTicket className="w-5 h-5" /> : <IoGift className="w-5 h-5" />}
                        </button>
                    );
                })}
            </div>
        </header>
    );
}
