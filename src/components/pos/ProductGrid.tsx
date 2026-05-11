"use client";

// =============================================================================
// ProductGrid — Tab lớn (category) + Tab nhỏ (typeName), tối ưu cảm ứng
// =============================================================================

import { useMemo, useState, useEffect } from "react";
import type { Product } from "@/lib/types/product";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface ProductGridProps {
    products: Product[];
    availableCategories: { id: number; label: string }[];
    selectedCategory: number | null;
    searchQuery: string;
    isLoading: boolean;
    onSelectCategory: (category: number | null) => void;
    onSearchChange: (query: string) => void;
    onAddToCart: (product: Product) => void;
}

export default function ProductGrid({
    products,
    availableCategories,
    selectedCategory,
    searchQuery,
    isLoading,
    onSelectCategory,
    onSearchChange,
    onAddToCart,
}: ProductGridProps) {
    const [selectedType, setSelectedType] = useState<string | null>(null);

    // Derive danh sách typeName
    const availableTypes = useMemo(() => {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const p of products) {
            const key = p.typeName || "Khác";
            if (!seen.has(key)) {
                seen.add(key);
                result.push(key);
            }
        }
        return result;
    }, [products]);

    // Tự chọn sub-tab đầu tiên khi danh sách thay đổi
    useEffect(() => {
        if (availableTypes.length > 0) {
            if (!selectedType || !availableTypes.includes(selectedType)) {
                setSelectedType(availableTypes[0]);
            }
        } else {
            setSelectedType(null);
        }
    }, [availableTypes, selectedType]);

    // Lọc theo sub-tab
    const displayProducts = useMemo(() => {
        if (!selectedType) return products;
        return products.filter((p) => (p.typeName || "Khác") === selectedType);
    }, [products, selectedType]);

    const handleSelectCategory = (catId: number | null) => {
        setSelectedType(null);
        onSelectCategory(catId);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Thanh tìm kiếm */}
            <div className="px-3 pt-3 pb-2 shrink-0">
                <div className="relative">
                    <svg
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                        />
                    </svg>
                    <input
                        type="text"
                        placeholder="Tìm sản phẩm..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl text-base text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors"
                    />
                </div>
            </div>

            {/* Tab lớn — Category */}
            <div className="px-3 pb-1.5 shrink-0">
                <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                    {availableCategories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => handleSelectCategory(cat.id)}
                            className={`px-5 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap transition-all duration-150 min-h-[44px] ${selectedCategory === cat.id
                                    ? "bg-[var(--color-accent)] text-white"
                                    : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-active)] active:bg-[var(--color-surface-active)]"
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab nhỏ — TypeName */}
            {availableTypes.length > 1 && (
                <div className="px-3 pb-2 shrink-0">
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
                        {availableTypes.map((typeName) => (
                            <button
                                key={typeName}
                                onClick={() => setSelectedType(typeName)}
                                className={`px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 min-h-[36px] border ${selectedType === typeName
                                        ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/40"
                                        : "text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]"
                                    }`}
                            >
                                {typeName}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Lưới sản phẩm */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3">
                {isLoading ? (
                    <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="skeleton h-32 rounded-2xl" />
                        ))}
                    </div>
                ) : displayProducts.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                        {displayProducts.map((product) => (
                            <ProductCard
                                key={product.goodsId}
                                product={product}
                                onAdd={() => onAddToCart(product)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ProductCard({
    product,
    onAdd,
}: {
    product: Product;
    onAdd: () => void;
}) {
    const displayPrice =
        product.afterTaxPrice > 0 ? product.afterTaxPrice : product.price;

    return (
        <button
            onClick={onAdd}
            className="group relative flex flex-col p-4 rounded-2xl border border-[var(--color-border)] hover:border-emerald-700/50 transition-all duration-150 text-left active:scale-[0.97] min-h-[100px]"
            style={{
                backgroundColor: product.backColor || "var(--color-surface)",
            }}
        >
            {/* Tên sản phẩm */}
            <p
                className="text-sm font-semibold leading-snug line-clamp-2 mb-2"
                style={{ color: product.foreColor || "var(--color-text-primary)" }}
            >
                {product.goodsName}
            </p>

            {/* Mã + Tồn kho (lưu niệm) */}
            {product.giftNo && (
                <span
                    className="text-[11px] opacity-70 mb-0.5"
                    style={{ color: product.foreColor || "#fff" }}
                >
                    Mã: {product.giftNo}
                </span>
            )}
            {product.category === 10 && (
                <span
                    className="text-[11px] opacity-70 mb-1"
                    style={{ color: product.foreColor || "#fff" }}
                >
                    Tồn: {product.amount.toLocaleString("vi-VN")}
                </span>
            )}

            {/* Giá */}
            <p
                className="text-base font-bold mt-auto pt-1"
                style={{ color: product.foreColor || "var(--color-accent)" }}
            >
                {displayPrice > 0 ? formatCurrency(displayPrice) : "Miễn phí"}
            </p>

            {/* Icon thêm */}
            <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity">
                <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke={product.foreColor || "#fff"}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                    />
                </svg>
            </div>
        </button>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
            <svg
                className="w-12 h-12 mb-3 opacity-40"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
            </svg>
            <p className="text-sm">Không tìm thấy sản phẩm</p>
            <p className="text-xs mt-1 opacity-60">
                Thử thay đổi bộ lọc hoặc đồng bộ sản phẩm
            </p>
        </div>
    );
}
