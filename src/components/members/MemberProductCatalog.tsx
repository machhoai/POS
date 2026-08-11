"use client";

import { useMemo, useState } from "react";
import {
  Coins,
  Gift,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Ticket,
} from "lucide-react";
import type { OrderItem } from "@/lib/types/order";
import type { Product } from "@/lib/types/product";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { getProductColors } from "@/lib/utils/productColors";

type MemberProductGroup = "POINTS" | "TICKETS" | "SOUVENIRS";

interface MemberProductCatalogProps {
  products: Product[];
  items: OrderItem[];
  isLoading: boolean;
  error: string | null;
  isPaymentLocked: boolean;
  memberReady: boolean;
  isRegistering: boolean;
  onReload: () => void;
  onAdd: (product: Product) => void;
  onUpdateQuantity: (goodsId: string, quantity: number) => void;
  onRegisterAndCheckout: () => void;
}

const PRODUCT_GROUPS: Array<{
  id: MemberProductGroup;
  label: string;
  categories: readonly number[];
  icon: typeof Coins;
}> = [
  { id: "POINTS", label: "Gói điểm", categories: [1, 2, 6], icon: Coins },
  { id: "TICKETS", label: "Vé", categories: [4], icon: Ticket },
  { id: "SOUVENIRS", label: "Quà lưu niệm", categories: [10], icon: Gift },
];

function matchesSearch(product: Product, query: string): boolean {
  if (!query) return true;
  return [
    product.goodsName,
    product.typeName,
    product.subCategory,
    product.giftNo,
    product.barCode,
  ].some((value) => value?.toLocaleLowerCase("vi").includes(query));
}

const MemberProductCatalog: React.FC<MemberProductCatalogProps> = ({
  products,
  items,
  isLoading,
  error,
  isPaymentLocked,
  memberReady,
  isRegistering,
  onReload,
  onAdd,
  onUpdateQuantity,
  onRegisterAndCheckout,
}) => {
  const [activeGroup, setActiveGroup] = useState<MemberProductGroup>("POINTS");
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("vi");
  const activeDefinition = PRODUCT_GROUPS.find((group) => group.id === activeGroup)!;

  const groupCounts = useMemo(() => new Map(
    PRODUCT_GROUPS.map((group) => [
      group.id,
      products.filter((product) => group.categories.includes(product.category)).length,
    ]),
  ), [products]);

  const visibleProducts = useMemo(
    () => products.filter(
      (product) => activeDefinition.categories.includes(product.category) &&
        matchesSearch(product, normalizedQuery),
    ),
    [activeDefinition.categories, normalizedQuery, products],
  );
  const quantities = useMemo(
    () => new Map(items.map((item) => [item.goodsId, item.quantity])),
    [items],
  );
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const totalAmount = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  return (
    <section className="flex h-[calc(100dvh-7rem)] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-sm lg:h-full lg:min-h-0">
      <header className="shrink-0 space-y-3 border-b border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Chọn sản phẩm</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Sản phẩm đã chọn sẽ được giữ trong đơn hàng hiện tại.</p>
          </div>
          <button type="button" onClick={onReload} disabled={isLoading} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-50" aria-label="Tải lại sản phẩm">
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <label className="relative block">
          <span className="sr-only">Tìm sản phẩm</span>
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm tên, nhóm hoặc mã sản phẩm..." className="h-12 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] pl-11 pr-4 text-sm font-semibold focus:border-[var(--color-accent)]" />
        </label>

        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Nhóm sản phẩm">
          {PRODUCT_GROUPS.map(({ id, label, icon: Icon }) => {
            const active = id === activeGroup;
            return (
              <button key={id} type="button" role="tab" aria-selected={active} onClick={() => setActiveGroup(id)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-sm font-bold transition-colors ${active ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-orange-50"}`}>
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-white"}`}>{groupCounts.get(id) || 0}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-[var(--color-background)] p-3">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
        ) : null}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl bg-slate-100" />)}</div>
        ) : visibleProducts.length === 0 ? (
          <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-white p-6 text-center text-sm font-semibold text-[var(--color-text-muted)]">Không tìm thấy sản phẩm trong nhóm {activeDefinition.label.toLocaleLowerCase("vi")}.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => {
              const quantity = quantities.get(product.goodsId) || 0;
              const displayPrice = product.afterTaxPrice > 0 ? product.afterTaxPrice : product.price;
              const GroupIcon = activeDefinition.icon;
              const colors = getProductColors(product);
              return (
                <article
                  key={product.goodsId}
                  className={`flex min-h-44 flex-col rounded-2xl border-2 bg-white p-3 transition ${quantity > 0 ? "shadow-sm" : ""}`}
                  style={{ borderColor: quantity > 0 ? colors.background : `color-mix(in srgb, ${colors.background} 24%, white)` }}
                >
                  <div className="flex items-start justify-between gap-2 rounded-xl p-2.5" style={{ backgroundColor: colors.background, color: colors.foreground }}>
                    <span className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${colors.foreground} 18%, transparent)` }}><GroupIcon className="size-5" /></span>
                    {quantity > 0 ? <span className="rounded-full px-2 py-1 text-xs font-black shadow-sm" style={{ backgroundColor: colors.foreground, color: colors.background }}>Đã chọn {quantity}</span> : null}
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-extrabold">{product.goodsName}</h3>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--color-text-muted)]">{product.typeName || product.subCategory || activeDefinition.label}</p>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                    <strong className="text-base" style={{ color: colors.accentText }}>{displayPrice > 0 ? formatCurrency(displayPrice) : "Miễn phí"}</strong>
                    {quantity > 0 ? (
                      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                        <button type="button" onClick={() => onUpdateQuantity(product.goodsId, quantity - 1)} disabled={isPaymentLocked} className="flex size-9 items-center justify-center rounded-lg bg-white disabled:opacity-40" aria-label={`Giảm ${product.goodsName}`}><Minus className="size-4" /></button>
                        <span className="min-w-7 text-center text-sm font-black">{quantity}</span>
                        <button type="button" onClick={() => onAdd(product)} disabled={isPaymentLocked} className="flex size-9 items-center justify-center rounded-lg disabled:opacity-40" style={{ backgroundColor: colors.background, color: colors.foreground }} aria-label={`Tăng ${product.goodsName}`}><Plus className="size-4" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => onAdd(product)} disabled={isPaymentLocked} className="flex size-10 items-center justify-center rounded-xl disabled:opacity-40" style={{ backgroundColor: colors.background, color: colors.foreground }} aria-label={`Thêm ${product.goodsName}`}><Plus className="size-5" /></button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-border)] bg-white p-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--color-text-muted)]">{itemCount} sản phẩm đã chọn</p>
          <p className="truncate text-xl font-black text-[var(--color-accent)]">{formatCurrency(totalAmount)}</p>
        </div>
        <button type="button" onClick={onRegisterAndCheckout} disabled={items.length === 0 || isPaymentLocked || isRegistering} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-500">
          {isRegistering ? <LoaderCircle className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
          {isRegistering ? "Đang đăng ký" : memberReady ? "Thanh toán" : "Đăng ký và thanh toán"}
        </button>
      </footer>
    </section>
  );
};

export default MemberProductCatalog;
