"use client";

// =============================================================================
// StoreSelector — Shown to admin users who don't have a pre-assigned storeId
// =============================================================================

import { useEffect, useState } from "react";
import {
  fetchAllActiveStores,
  type StoreInfo,
} from "@/lib/services/authService";

interface StoreSelectorProps {
  adminName: string;
  onSelectStore: (storeId: string) => void;
  onLogout: () => void;
}

export default function StoreSelector({
  adminName,
  onSelectStore,
  onLogout,
}: StoreSelectorProps) {
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStores() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchAllActiveStores();
        setStores(data);
        if (data.length === 0) {
          setError("Không có cửa hàng nào đang hoạt động.");
        }
      } catch {
        setError("Không thể tải danh sách cửa hàng.");
      } finally {
        setIsLoading(false);
      }
    }
    loadStores();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Chọn cửa hàng
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Xin chào <span className="text-[var(--color-accent)] font-medium">{adminName}</span>,
            vui lòng chọn cửa hàng để bắt đầu phiên POS.
          </p>
        </div>

        {/* Store List */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <svg
                className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-muted)] opacity-40"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {stores.map((store) => (
                <li key={store.id}>
                  <button
                    onClick={() => onSelectStore(store.id)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[var(--color-surface-hover)] transition-colors text-left group"
                  >
                    {/* Store Icon */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-800/20 flex items-center justify-center shrink-0 group-hover:from-emerald-500/20 group-hover:to-teal-500/20 transition-colors">
                      <svg
                        className="w-5 h-5 text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"
                        />
                      </svg>
                    </div>

                    {/* Store Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {store.name}
                      </p>
                      {store.address && (
                        <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                          {store.address}
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <svg
                      className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m8.25 4.5 7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Logout Button */}
        <div className="mt-6 text-center">
          <button
            onClick={onLogout}
            className="text-sm text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
