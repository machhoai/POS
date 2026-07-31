"use client";

import type { WarehouseInfo } from "@/lib/types/user";

interface StoreSelectorProps {
  userName: string;
  warehouses: WarehouseInfo[];
  onSelectWarehouse: (warehouseId: string) => void;
  onLogout: () => void;
}

export default function StoreSelector({
  userName,
  warehouses,
  onSelectWarehouse,
  onLogout,
}: StoreSelectorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-4">
      <div className="w-full max-w-md">
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
                d="M3 21h18M5.25 21V6.75A2.25 2.25 0 0 1 7.5 4.5h9a2.25 2.25 0 0 1 2.25 2.25V21M9 9h.008v.008H9V9Zm0 3.75h.008v.008H9v-.008Zm0 3.75h.008v.008H9V16.5Zm3-7.5h.008v.008H12V9Zm0 3.75h.008v.008H12v-.008Zm0 3.75h.008v.008H12V16.5Zm3-7.5h.008v.008H15V9Zm0 3.75h.008v.008H15v-.008Zm0 3.75h.008v.008H15V16.5Z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Chọn cửa hàng
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Xin chào{" "}
            <span className="text-[var(--color-accent)] font-medium">
              {userName}
            </span>
            , vui lòng chọn cửa hàng cho phiên POS.
          </p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {warehouses.map((warehouse) => (
              <li key={warehouse.id}>
                <button
                  type="button"
                  onClick={() => onSelectWarehouse(warehouse.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[var(--color-surface-hover)] transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-800/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-emerald-500">
                      {warehouse.code || "POS"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {warehouse.name}
                    </p>
                    {warehouse.address && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                        {warehouse.address}
                      </p>
                    )}
                  </div>
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
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
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
