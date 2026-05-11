"use client";

// =============================================================================
// VoucherInput — Nhập/Quét mã voucher trong giỏ hàng
// =============================================================================

import { useState } from "react";

interface VoucherInputProps {
    /** Voucher đã áp dụng (null = chưa có) */
    appliedVoucher: AppliedVoucher | null;
    /** Callback khi áp dụng mã voucher */
    onApplyVoucher: (code: string) => void;
    /** Callback khi xóa voucher đã áp dụng */
    onRemoveVoucher: () => void;
    /** Đang xác thực voucher */
    isValidating?: boolean;
}

export interface AppliedVoucher {
    code: string;
    description: string;
    discountAmount: number;
}

export default function VoucherInput({
    appliedVoucher,
    onApplyVoucher,
    onRemoveVoucher,
    isValidating = false,
}: VoucherInputProps) {
    const [code, setCode] = useState("");
    const [isExpanded, setIsExpanded] = useState(false);

    const handleApply = () => {
        const trimmed = code.trim();
        if (!trimmed) return;
        onApplyVoucher(trimmed);
        setCode("");
    };

    const handleScanCamera = () => {
        // TODO: Tích hợp Tauri camera API để quét mã vạch
        // Tạm thời hiển thị thông báo
        alert("Tính năng quét camera sẽ được tích hợp sau.");
    };

    // Đã áp dụng voucher → hiển thị badge
    if (appliedVoucher) {
        return (
            <div className="flex items-center gap-2 p-3 bg-amber-900/20 border border-amber-700/30 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                    <svg
                        className="w-4 h-4 text-amber-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 14.25l3-3m0 0l3 3m-3-3v8.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-300 truncate">
                        {appliedVoucher.code}
                    </p>
                    <p className="text-[11px] text-amber-400/70 truncate">
                        {appliedVoucher.description}
                    </p>
                </div>
                <button
                    onClick={onRemoveVoucher}
                    className="w-9 h-9 flex items-center justify-center text-amber-400/60 hover:text-red-400 active:bg-red-500/10 rounded-lg transition-colors shrink-0"
                    aria-label="Xóa voucher"
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
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        );
    }

    // Chưa mở → nút toggle nhỏ gọn
    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] active:bg-[var(--color-surface-hover)] rounded-xl border border-dashed border-[var(--color-border)] transition-colors min-h-[40px]"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z"
                    />
                </svg>
                Có mã voucher?
            </button>
        );
    }

    // Form nhập voucher
    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                {/* Ô nhập mã */}
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && handleApply()}
                        placeholder="Nhập mã voucher..."
                        autoFocus
                        className="w-full px-3.5 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors uppercase tracking-wider min-h-[48px]"
                    />
                </div>

                {/* Nút quét camera */}
                <button
                    onClick={handleScanCamera}
                    className="w-12 h-12 flex items-center justify-center bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:bg-[var(--color-surface-active)] transition-colors shrink-0"
                    aria-label="Quét mã bằng camera"
                >
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                        />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                        />
                    </svg>
                </button>
            </div>

            {/* Hàng nút: Hủy + Áp dụng */}
            <div className="flex gap-2">
                <button
                    onClick={() => {
                        setIsExpanded(false);
                        setCode("");
                    }}
                    className="flex-1 py-2.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] rounded-xl active:bg-[var(--color-surface-active)] transition-colors min-h-[40px]"
                >
                    Hủy
                </button>
                <button
                    onClick={handleApply}
                    disabled={!code.trim() || isValidating}
                    className="flex-1 py-2.5 text-xs font-semibold text-amber-900 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl transition-colors min-h-[40px] flex items-center justify-center gap-1.5"
                >
                    {isValidating ? (
                        <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Đang kiểm tra...
                        </>
                    ) : (
                        "Áp dụng"
                    )}
                </button>
            </div>
        </div>
    );
}
