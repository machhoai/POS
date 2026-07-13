"use client";

interface TopNavProps {
    storeName: string;
    cashierName: string;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onSyncProducts: () => void;
    isSyncing: boolean;
}

export default function TopNav({
    storeName,
    cashierName,
    searchQuery,
    onSearchChange,
    onSyncProducts,
    isSyncing,
}: TopNavProps) {
    const firstName = cashierName.trim().split(/\s+/).at(-1) || cashierName;
    const initials = cashierName
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

    return (
        <header className="bg-[var(--color-background)] flex items-center gap-5 px-2 py-2 shrink-0">
            <div className="min-w-[190px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] mb-1">
                    {storeName}
                </p>
                <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
                    Xin chào, {firstName}!
                </h1>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Chọn sản phẩm để bắt đầu đơn hàng mới
                </p>
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
                    placeholder="Tìm tên hoặc nhóm sản phẩm..."
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

            <div className="w-12 h-12 rounded-xl bg-[#242629] text-white flex items-center justify-center text-sm font-bold shadow-[var(--shadow-sm)]" title={cashierName}>
                {initials || "NV"}
            </div>
        </header>
    );
}
