"use client";

// =============================================================================
// Main POS Dashboard — Cashier interface
// =============================================================================
// Layout: TopNav | ProductGrid (left) | CartPanel (right)
// Auth-guarded: redirects to /login if not authenticated.
// =============================================================================

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCartStore, selectTotalAmount, selectItemCount } from "@/lib/stores/useCartStore";
import { useProductStore, selectFilteredProducts } from "@/lib/stores/useProductStore";
import TopNav from "@/components/pos/TopNav";
import ProductGrid from "@/components/pos/ProductGrid";
import CartPanel from "@/components/pos/CartPanel";
import StoreSelector from "@/components/pos/StoreSelector";
import type { Product } from "@/lib/types/product";

export default function CashierPage() {
  const router = useRouter();
  const { user, userDoc, effectiveStoreId, isLoading: authLoading, logout, needsStoreSelection, selectStore } = useAuth();

  // ── Product Store ──────────────────────────────────────────────────────
  const products = useProductStore(selectFilteredProducts);
  const categories = useProductStore((s) => s.categories);
  const selectedCategoryId = useProductStore((s) => s.selectedCategoryId);
  const searchQuery = useProductStore((s) => s.searchQuery);
  const isProductsLoading = useProductStore((s) => s.isLoading);
  const fetchProducts = useProductStore((s) => s.fetchProducts);
  const setSelectedCategory = useProductStore((s) => s.setSelectedCategory);
  const setSearchQuery = useProductStore((s) => s.setSearchQuery);

  // ── Cart Store ─────────────────────────────────────────────────────────
  const cartItems = useCartStore((s) => s.items);
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const isCheckingOut = useCartStore((s) => s.isCheckingOut);
  const currentOrderId = useCartStore((s) => s.currentOrderId);
  const totalAmount = useCartStore(selectTotalAmount);
  const itemCount = useCartStore(selectItemCount);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const setPaymentMethod = useCartStore((s) => s.setPaymentMethod);
  const checkout = useCartStore((s) => s.checkout);
  const clearCart = useCartStore((s) => s.clearCart);

  // ── Auth Guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (!user || !userDoc)) {
      router.replace("/login");
    }
  }, [authLoading, user, userDoc, router]);

  // ── Load Products on Mount ─────────────────────────────────────────────
  useEffect(() => {
    if (effectiveStoreId) {
      fetchProducts(effectiveStoreId);
    }
  }, [effectiveStoreId, fetchProducts]);

  // ── Product Sync (via Cloud Function — placeholder for now) ────────────
  const handleSyncProducts = useCallback(async () => {
    if (!effectiveStoreId) return;
    // For now, just re-fetch from Firestore
    // TODO: Call syncProducts Cloud Function first, then re-fetch
    await fetchProducts(effectiveStoreId);
  }, [effectiveStoreId, fetchProducts]);

  // ── Add to Cart ────────────────────────────────────────────────────────
  const handleAddToCart = useCallback(
    (product: Product) => {
      addItem({
        goodsId: product.goodsId,
        goodsName: product.goodsName,
        price: product.price,
        quantity: 1,
      });
    },
    [addItem]
  );

  // ── Checkout ───────────────────────────────────────────────────────────
  const handleCheckout = useCallback(async () => {
    if (!effectiveStoreId) return;
    try {
      // Use storeId as shopId (numeric) for order creation
      const shopId = Number(effectiveStoreId) || 1;
      await checkout(shopId);
    } catch (error) {
      console.error("[POS] Lỗi thanh toán:", error);
    }
  }, [effectiveStoreId, checkout]);

  // ── Loading / Auth Guard State ─────────────────────────────────────────
  if (authLoading || !user || !userDoc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Đang tải...</p>
        </div>
      </div>
    );
  }

  // ── Admin Store Selector ────────────────────────────────────────────────
  if (needsStoreSelection) {
    return (
      <StoreSelector
        adminName={userDoc.name}
        onSelectStore={selectStore}
        onLogout={logout}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <TopNav
        storeName={effectiveStoreId || "Cửa hàng"}
        cashierName={userDoc.name}
        onLogout={logout}
        onSyncProducts={handleSyncProducts}
        isSyncing={isProductsLoading}
      />

      {/* Main Content: Product Grid + Cart */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Product Grid (takes remaining space) */}
        <div className="flex-1 min-w-0 border-r border-[var(--color-border)]">
          <ProductGrid
            products={products}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            searchQuery={searchQuery}
            isLoading={isProductsLoading}
            onSelectCategory={setSelectedCategory}
            onSearchChange={setSearchQuery}
            onAddToCart={handleAddToCart}
          />
        </div>

        {/* Right: Cart Panel (fixed width) */}
        <div className="w-80 xl:w-96 shrink-0">
          <CartPanel
            items={cartItems}
            paymentMethod={paymentMethod}
            isCheckingOut={isCheckingOut}
            currentOrderId={currentOrderId}
            totalAmount={totalAmount}
            itemCount={itemCount}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onSetPaymentMethod={setPaymentMethod}
            onCheckout={handleCheckout}
            onClearCart={clearCart}
          />
        </div>
      </div>
    </div>
  );
}
