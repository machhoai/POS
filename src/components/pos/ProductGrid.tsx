"use client";

// =============================================================================
// ProductGrid — Displays the product catalog with category tabs and search
// =============================================================================

import type { Product } from "@/lib/types/product";
import { CATEGORY_MAP } from "@/lib/types/product";
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
  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
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
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 pb-3 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
          <CategoryTab
            label="Tất cả"
            isActive={selectedCategory === null}
            onClick={() => onSelectCategory(null)}
          />
          {availableCategories.map((cat) => (
            <CategoryTab
              key={cat.id}
              label={cat.label}
              isActive={selectedCategory === cat.id}
              onClick={() => onSelectCategory(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
        {isLoading ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-36 rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {products.map((product) => (
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

function CategoryTab({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 ${
        isActive
          ? "bg-[var(--color-accent)] text-white shadow-md shadow-emerald-500/20"
          : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-active)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {label}
    </button>
  );
}

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: () => void;
}) {
  const categoryLabel = CATEGORY_MAP[product.category] || "";

  return (
    <button
      onClick={onAdd}
      className="group relative flex flex-col p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:border-emerald-700/50 hover:bg-[var(--color-surface-hover)] transition-all duration-150 text-left active:scale-[0.98]"
    >
      {/* Product icon */}
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-800/20 flex items-center justify-center mb-2.5 group-hover:from-emerald-500/20 group-hover:to-teal-500/20 transition-colors">
        <span className="text-lg">{getCategoryEmoji(product.category)}</span>
      </div>

      {/* Name */}
      <p className="text-sm font-medium text-[var(--color-text-primary)] leading-snug line-clamp-2 mb-1.5">
        {product.goodsName}
      </p>

      {/* Category Badge */}
      {categoryLabel && (
        <span className="inline-block text-[10px] px-1.5 py-0.5 bg-[var(--color-surface-active)] text-[var(--color-text-muted)] rounded-md mb-2 w-fit">
          {categoryLabel}
        </span>
      )}

      {/* Price */}
      <p className="text-sm font-bold text-[var(--color-accent)] mt-auto">
        {formatCurrency(product.price)}
      </p>

      {/* Hover add indicator */}
      <div className="absolute bottom-2.5 right-2.5 w-6 h-6 rounded-md bg-[var(--color-accent)] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md shadow-emerald-500/20">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </div>
    </button>
  );
}

/** Map category ID to a display emoji for product cards. */
function getCategoryEmoji(category: number): string {
  switch (category) {
    case 1: return "🪙";  // Gói Xu
    case 2: return "⭐";  // Gói Điểm
    case 4: return "🎫";  // Vé & Combo
    case 6: return "💳";  // Nạp Thẻ
    default: return "🦆";
  }
}
