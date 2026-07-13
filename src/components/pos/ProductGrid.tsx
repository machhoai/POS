"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { Product } from "@/lib/types/product";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface ProductGridProps {
    products: Product[];
    availableCategories: { id: number; label: string }[];
    selectedCategory: number | null;
    isLoading: boolean;
    onSelectCategory: (category: number | null) => void;
    onAddToCart: (product: Product) => void;
}

const CATEGORY_ICON_PATHS: Record<number, string> = {
    1: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 15 0A17.9 17.9 0 0 1 12 21.75c-2.68 0-5.22-.58-7.5-1.65Z",
    4: "M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.38 5.25c-.62 0-1.13.5-1.13 1.13V9.4a3 3 0 0 1 0 5.2v3.03c0 .62.5 1.12 1.13 1.12h17.25c.62 0 1.12-.5 1.12-1.12V14.6a3 3 0 0 1 0-5.2V6.38c0-.62-.5-1.13-1.12-1.13H3.38Z",
    10: "M21 8.25v10.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25m18 0A2.25 2.25 0 0 0 18.75 6H5.25A2.25 2.25 0 0 0 3 8.25m18 0V9A2.25 2.25 0 0 1 18.75 11.25H5.25A2.25 2.25 0 0 1 3 9v-.75m9-2.25v15m0-15H9.88a2.63 2.63 0 1 1 0-5.25C11.34.75 12 3 12 3s.66-2.25 2.13-2.25a2.63 2.63 0 1 1 0 5.25H12Z",
};

export default function ProductGrid({
    products,
    availableCategories,
    selectedCategory,
    isLoading,
    onSelectCategory,
    onAddToCart,
}: ProductGridProps) {
    const [selectedType, setSelectedType] = useState<string | null>(null);

    const availableTypes = useMemo(
        () => Array.from(new Set(products.map((product) => product.typeName || "Khác"))),
        [products],
    );

    const displayProducts = useMemo(() => {
        if (!selectedType || !availableTypes.includes(selectedType)) return products;
        return products.filter((product) => (product.typeName || "Khác") === selectedType);
    }, [availableTypes, products, selectedType]);

    const handleSelectCategory = (categoryId: number) => {
        setSelectedType(null);
        onSelectCategory(categoryId);
    };

    return (
        <section className="flex flex-col h-full min-h-0 bg-[var(--color-background)]">
            <div className="px-4 pb-3 shrink-0">
                <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-thin pb-1">
                    {availableCategories.map((category) => {
                        const isActive = selectedCategory === category.id;

                        return (
                            <button
                                type="button"
                                key={category.id}
                                onClick={() => handleSelectCategory(category.id)}
                                className={`h-11 px-4 flex items-center gap-2 rounded-xl whitespace-nowrap text-xs font-semibold border transition-all ${isActive
                                    ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                                    : "bg-white border-transparent text-[var(--color-text-secondary)] hover:border-orange-200 hover:text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]"
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d={CATEGORY_ICON_PATHS[category.id] ?? CATEGORY_ICON_PATHS[10]} />
                                </svg>
                                {category.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="px-4 pb-2 flex items-end justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-lg font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">Sản phẩm</h2>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {displayProducts.length} lựa chọn đang hiển thị
                    </p>
                </div>

                {availableTypes.length > 1 && (
                    <div className="flex items-center gap-1 overflow-x-auto over scrollbar-thin max-w-[65%] pb-1">
                        <TypeButton active={selectedType === null} label="Tất cả" onClick={() => setSelectedType(null)} />
                        {availableTypes.map((typeName) => (
                            <TypeButton
                                key={typeName}
                                active={selectedType === typeName}
                                label={typeName}
                                onClick={() => setSelectedType(typeName)}
                            />
                        ))}
                    </div>
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

function TypeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-[11px] font-semibold border transition-colors ${active
                ? "bg-[#242629] border-[#242629] text-white"
                : "bg-transparent border-transparent text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text-primary)]"
                }`}
        >
            {label}
        </button>
    );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
    const displayPrice = product.afterTaxPrice > 0 ? product.afterTaxPrice : product.price;
    const artworkColor = /^#[0-9a-f]{6}$/i.test(product.backColor) ? product.backColor : "#f97316";
    const rgb = [1, 3, 5].map((offset) => Number.parseInt(artworkColor.slice(offset, offset + 2), 16));
    const isLightArtwork = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 210;
    const iconColor = isLightArtwork && /^#[0-9a-f]{6}$/i.test(product.foreColor)
        ? product.foreColor
        : artworkColor;
    const artworkStyle = {
        backgroundColor: `color-mix(in srgb, ${artworkColor} 13%, #f4f1ec)`,
    } as CSSProperties;
    const description =
        product.description ||
        (product.category === 4
            ? `${product.typeName} · Sẵn sàng sử dụng tại quầy`
            : product.category === 1
                ? `${product.typeName} · Quyền lợi thành viên`
                : `${product.subCategory || product.typeName} · Mã ${product.giftNo || product.goodsId.slice(0, 6)}`);

    return (
        <article className="group relative min-w-0 bg-white rounded-2xl border border-white shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all overflow-hidden">
            <button type="button" onClick={onAdd} className="w-full text-left" aria-label={`Thêm ${product.goodsName} vào giỏ`}>
                <div className="relative h-[132px] m-2.5 mb-0 rounded-[13px] overflow-hidden" style={artworkStyle}>
                    <div className="absolute -right-8 -top-10 w-28 h-28 rounded-full bg-white/35" />
                    <div className="absolute -left-7 -bottom-10 w-24 h-24 rounded-full bg-white/30" />
                    <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[74px] h-[74px] rounded-[24px] rotate-[-5deg] flex items-center justify-center shadow-[0_14px_28px_rgba(24,24,27,0.12)]"
                        style={{ backgroundColor: iconColor }}
                    >
                        <svg className="w-9 h-9 text-white drop-shadow-sm rotate-[5deg]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d={CATEGORY_ICON_PATHS[product.category] ?? CATEGORY_ICON_PATHS[10]} />
                        </svg>
                    </div>
                    <span className="absolute left-2.5 top-2.5 max-w-[70%] px-2 py-1 rounded-md bg-white/80 backdrop-blur-sm text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)] truncate">
                        {product.typeName || "Sản phẩm"}
                    </span>
                    <span className="absolute right-2.5 top-2.5 w-8 h-8 rounded-lg bg-white/90 text-[var(--color-accent)] flex items-center justify-center shadow-sm group-hover:bg-[var(--color-accent)] group-hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.39c.51 0 .95.34 1.09.84l.38 1.43M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.22a60.1 60.1 0 0 0 2.92-7.14 60.1 60.1 0 0 0-16.53-1.84L7.5 14.25Z" />
                        </svg>
                    </span>
                </div>

                <div className="p-3.5 pt-3">
                    <h3 className="text-[13px] font-bold leading-snug text-[var(--color-text-primary)] line-clamp-2 min-h-[36px]">
                        {product.goodsName}
                    </h3>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--color-text-muted)] line-clamp-2 min-h-[28px]">
                        {description}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                        <p className="text-base font-extrabold tracking-[-0.02em] text-[var(--color-accent)]">
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
