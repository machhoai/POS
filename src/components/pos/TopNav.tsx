"use client";

// =============================================================================
// TopNav — POS header bar with store info, cashier name, and actions
// =============================================================================

interface TopNavProps {
  storeName: string;
  cashierName: string;
  onLogout: () => void;
  onSyncProducts: () => void;
  isSyncing: boolean;
}

export default function TopNav({
  storeName,
  cashierName,
  onLogout,
  onSyncProducts,
  isSyncing,
}: TopNavProps) {
  return (
    <header className="h-14 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-4 shrink-0">
      {/* Left: Logo + Store Name */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight text-[var(--color-text-primary)]">
            {storeName}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">Hệ thống POS</p>
        </div>
      </div>

      {/* Right: Sync + Cashier + Logout */}
      <div className="flex items-center gap-2">
        {/* Sync Button */}
        <button
          onClick={onSyncProducts}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-active)] border border-[var(--color-border)] rounded-lg transition-colors disabled:opacity-50"
          title="Đồng bộ sản phẩm"
        >
          <svg
            className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
          {isSyncing ? "Đang đồng bộ..." : "Đồng bộ"}
        </button>

        {/* Cashier Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-accent-subtle)] border border-emerald-800/30 rounded-lg">
          <div className="w-5 h-5 rounded-full bg-emerald-600/30 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
          </div>
          <span className="text-xs font-medium text-emerald-300">{cashierName}</span>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="p-1.5 text-[var(--color-text-muted)] hover:text-red-400 hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors"
          title="Đăng xuất"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
