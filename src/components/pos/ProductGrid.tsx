"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import type { Product } from "@/lib/types/product";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { getProductColors } from "@/lib/utils/productColors";
import { ShoppingCart } from "lucide-react";
import { IoGift, IoTicket, IoChevronDown, IoFilterOutline } from "react-icons/io5";

interface ProductGridProps {
    products: Product[];
    isLoading: boolean;
    onAddToCart: (product: Product) => void;
}

export default function ProductGrid({
    products,
    isLoading,
    onAddToCart,
}: ProductGridProps) {
    const [selectedType, setSelectedType] = useState<string | null>(null);

    const typeCounts = useMemo(() => {
        const map = new Map<string, number>();
        products.forEach((p) => {
            const typeName = p.typeName || "Khác";
            map.set(typeName, (map.get(typeName) || 0) + 1);
        });
        return map;
    }, [products]);

    const availableTypes = useMemo(
        () => Array.from(typeCounts.keys()).sort((a, b) => (typeCounts.get(b) || 0) - (typeCounts.get(a) || 0)),
        [typeCounts],
    );

    const displayProducts = useMemo(() => {
        if (!selectedType || !availableTypes.includes(selectedType)) return products;
        return products.filter((product) => (product.typeName || "Khác") === selectedType);
    }, [availableTypes, products, selectedType]);

    return (
        <section className="flex flex-col h-full min-h-0 bg-[var(--color-background)]">
            <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-gray-100/50">
                {availableTypes.length > 1 && (
                    <TypeFilterSelector
                        availableTypes={availableTypes}
                        typeCounts={typeCounts}
                        selectedType={selectedType}
                        onSelectType={setSelectedType}
                        totalCount={products.length}
                    />
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 pb-7 pt-1">
                {isLoading ? (
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="skeleton h-[270px] rounded-2xl" />
                        ))}
                    </div>
                ) : displayProducts.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                        {displayProducts.map((product) => (
                            <ProductCard key={product.goodsId} product={product} onAdd={() => onAddToCart(product)} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function TypeFilterSelector({
    availableTypes,
    typeCounts,
    selectedType,
    onSelectType,
    totalCount,
}: {
    availableTypes: string[];
    typeCounts: Map<string, number>;
    selectedType: string | null;
    onSelectType: (type: string | null) => void;
    totalCount: number;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const MAX_VISIBLE_PILLS = 4;
    const visibleTypes = availableTypes.slice(0, MAX_VISIBLE_PILLS);
    const hiddenTypes = availableTypes.slice(MAX_VISIBLE_PILLS);

    const isSelectedInHidden = selectedType !== null && hiddenTypes.includes(selectedType);

    const filteredHiddenTypes = useMemo(() => {
        if (!searchQuery.trim()) return hiddenTypes;
        return hiddenTypes.filter((t) =>
            t.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [hiddenTypes, searchQuery]);

    return (
        <div className="relative flex items-center gap-1.5 flex-wrap justify-end" ref={dropdownRef}>
            {/* Pill: Tất cả */}
            <button
                type="button"
                onClick={() => onSelectType(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${selectedType === null
                    ? "bg-[#242629] border-[#242629] text-white shadow-sm"
                    : "bg-white border-transparent text-[var(--color-text-secondary)] hover:bg-gray-100 hover:text-[var(--color-text-primary)] shadow-sm"
                    }`}
            >
                <span>Tất cả</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedType === null ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                    {totalCount}
                </span>
            </button>

            {/* Visible Pills (Top 3 most popular) */}
            {visibleTypes.map((type) => {
                const count = typeCounts.get(type) || 0;
                const isActive = selectedType === type;
                return (
                    <button
                        key={type}
                        type="button"
                        onClick={() => onSelectType(type)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${isActive
                            ? "bg-[#242629] border-[#242629] text-white shadow-sm"
                            : "bg-white border-transparent text-[var(--color-text-secondary)] hover:bg-gray-100 hover:text-[var(--color-text-primary)] shadow-sm"
                            }`}
                    >
                        <span>{type}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                            }`}>
                            {count}
                        </span>
                    </button>
                );
            })}

            {/* Dropdown for remaining types */}
            {hiddenTypes.length > 0 && (
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${isSelectedInHidden
                            ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-sm"
                            : isOpen
                                ? "bg-gray-200 border-gray-300 text-gray-900"
                                : "bg-white border-transparent text-[var(--color-text-secondary)] hover:bg-gray-100 hover:text-[var(--color-text-primary)] shadow-sm"
                            }`}
                    >
                        <IoFilterOutline className="w-3.5 h-3.5" />
                        <span className="max-w-[120px] truncate">
                            {isSelectedInHidden ? selectedType : `+${hiddenTypes.length} loại khác`}
                        </span>
                        <IoChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Popover Menu */}
                    {isOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                            {hiddenTypes.length > 5 && (
                                <div className="p-1 mb-1 border-b border-gray-100">
                                    <input
                                        type="text"
                                        placeholder="Tìm phân loại..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:border-orange-400 focus:bg-white"
                                        autoFocus
                                    />
                                </div>
                            )}

                            <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-thin pr-1">
                                {filteredHiddenTypes.map((type) => {
                                    const count = typeCounts.get(type) || 0;
                                    const isActive = selectedType === type;
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => {
                                                onSelectType(type);
                                                setIsOpen(false);
                                            }}
                                            className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${isActive
                                                ? "bg-[var(--color-accent)] text-white"
                                                : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                        >
                                            <span className="truncate pr-2">{type}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                                                }`}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}

                                {filteredHiddenTypes.length === 0 && (
                                    <p className="text-xs text-gray-400 text-center py-3">Không tìm thấy loại phù hợp</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
    const displayPrice = product.afterTaxPrice > 0 ? product.afterTaxPrice : product.price;
    const colors = getProductColors(product);
    const description =
        product.description ||
        (product.category === 4
            ? `${product.typeName}`
            : product.category === 1
                ? `${product.typeName} · Quyền lợi thành viên`
                : `${product.subCategory || product.typeName} · Mã ${product.giftNo || product.goodsId.slice(0, 6)}`);

    return (
        <article
            className="group relative min-w-0 overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
            style={{ borderColor: `color-mix(in srgb, ${colors.background} 28%, white)` }}
        >
            <button type="button" onClick={onAdd} className="w-full text-left" aria-label={`Thêm ${product.goodsName} vào giỏ`}>
                <div className="relative m-2.5 mb-0 h-[132px] overflow-hidden rounded-[13px]" style={{ backgroundColor: colors.background }}>
                    <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/20" />
                    <div className="absolute -bottom-10 -left-7 h-24 w-24 rounded-full bg-white/15" />
                    <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 p-5 -translate-y-1/2 w-[74px] h-[74px] rounded-[24px] rotate-[-5deg] flex items-center justify-center shadow-[0_14px_28px_rgba(24,24,27,0.12)]"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${colors.foreground} 18%, transparent)`,
                            color: colors.foreground,
                        }}
                    >
                        {product.category == 4 ? <IoTicket className="size-full rotate-45" /> : <IoGift className="size-full -rotate-2" />}
                    </div>
                    <span
                        className="absolute left-2.5 top-2.5 max-w-[70%] truncate rounded-md px-2 py-1 text-[12px] font-bold uppercase tracking-wide shadow-sm"
                        style={{ backgroundColor: colors.foreground, color: colors.background }}
                    >
                        {product.typeName || "Sản phẩm"}
                    </span>
                    <span
                        className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg p-1 shadow-sm"
                        style={{ backgroundColor: colors.foreground, color: colors.background }}
                    >
                        <ShoppingCart className="size-4" />
                    </span>
                </div>

                <div className="p-3.5 pt-3">
                    <h3 className="text-[14px] font-bold leading-snug text-[var(--color-text-primary)] line-clamp-2">
                        {product.goodsName}
                    </h3>
                    <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)] line-clamp-2">
                        {description}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                        <p className="text-base font-extrabold tracking-[-0.02em]" style={{ color: colors.accentText }}>
                            {displayPrice > 0 ? formatCurrency(displayPrice) : "Miễn phí"}
                        </p>
                        <span className="text-[10px] font-medium text-[var(--color-text-muted)] whitespace-nowrap">
                            {product.category === 10 ? `Tồn ${product.amount.toLocaleString("vi-VN")}` : `${product.amount || 1} lượt`}
                        </span>
                    </div>
                </div>
            </button>
        </article>
    );
}

function EmptyState() {
    return (
        <div className="h-full min-h-64 flex flex-col items-center justify-center text-center text-[var(--color-text-muted)]">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-[var(--shadow-sm)] mb-3">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.2-5.2m0 0A7.5 7.5 0 1 0 5.2 5.2a7.5 7.5 0 0 0 10.6 10.6Z" />
                </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Không tìm thấy sản phẩm</p>
            <p className="text-xs mt-1">Thử từ khóa hoặc nhóm sản phẩm khác</p>
        </div>
    );
}
