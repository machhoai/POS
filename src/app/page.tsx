"use client";

// =============================================================================
// Main POS Dashboard — Cashier interface
// =============================================================================
// Layout: Sidebar (left) | Product workspace (center) | Cart (right)
// Auth-guarded: redirects to /login if not authenticated.
// =============================================================================

import { useEffect, useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCartStore, selectTotalAmount, selectItemCount } from "@/lib/stores/useCartStore";
import { useProductStore } from "@/lib/stores/useProductStore";
import { JPOS_PAYMENT_METHODS } from "@/lib/data/paymentMethods";
import { syncProducts } from "@/lib/services/productService";
import { showError, showPromise } from "@/lib/utils/toast";
import TopNav from "@/components/pos/TopNav";
import Sidebar from "@/components/layout/Sidebar";
import ProductGrid from "@/components/pos/ProductGrid";
import CartPanel from "@/components/pos/CartPanel";
import StoreSelector from "@/components/pos/StoreSelector";
import type { Product } from "@/lib/types/product";

export default function CashierPage() {
  const router = useRouter();
  const {
    user,
    userDoc,
    availableWarehouses,
    effectiveWarehouseId,
    effectiveWarehouseName,
    isLoading: authLoading,
    logout,
    needsWarehouseSelection,
    selectWarehouse,
  } = useAuth();

  // ── Product Store ──────────────────────────────────────────────────────
  const allProducts = useProductStore((s) => s.products);
  const availableCategories = useProductStore((s) => s.availableCategories);
  const selectedCategory = useProductStore((s) => s.selectedCategory);
  const searchQuery = useProductStore((s) => s.searchQuery);

  const products = useMemo(() => {
    let filtered = allProducts;
    if (selectedCategory !== null) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (product) =>
          product.goodsName.toLowerCase().includes(q) ||
          product.typeName.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [allProducts, selectedCategory, searchQuery]);

  // Derive filtered products — useMemo tránh tạo array mới mỗi render
  const isProductsLoading = useProductStore((s) => s.isLoading);
  const fetchProducts = useProductStore((s) => s.fetchProducts);
  const setSelectedCategory = useProductStore((s) => s.setSelectedCategory);
  const setSearchQuery = useProductStore((s) => s.setSearchQuery);

  // ── Cart Store ─────────────────────────────────────────────────────────
  const cartItems = useCartStore((s) => s.items);
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const isCheckingOut = useCartStore((s) => s.isCheckingOut);
  const currentOrderId = useCartStore((s) => s.currentOrderId);
  const currentHkOrderNumber = useCartStore((s) => s.currentHkOrderNumber);
  const currentOrderStatus = useCartStore((s) => s.currentOrderStatus);
  const totalAmount = useCartStore(selectTotalAmount);
  const itemCount = useCartStore(selectItemCount);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const setPaymentMethod = useCartStore((s) => s.setPaymentMethod);
  const checkout = useCartStore((s) => s.checkout);
  const prepareCurrentOrder = useCartStore((s) => s.prepareCurrentOrder);
  const refreshCurrentOrderStatus = useCartStore((s) => s.refreshCurrentOrderStatus);
  const clearCart = useCartStore((s) => s.clearCart);
  const paymentMethods = JPOS_PAYMENT_METHODS;
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const shopId = Number(process.env.NEXT_PUBLIC_SHOP_ID) || 1;

  // ── Auth Guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (!user || !userDoc)) {
      router.replace("/login");
    }
  }, [authLoading, user, userDoc, router]);

  // ── Load Products on Mount ─────────────────────────────────────────────
  useEffect(() => {
    if (user && userDoc) {
      void fetchProducts();
    }
  }, [user, userDoc, fetchProducts]);

  useEffect(() => {
    if (
      paymentMethods.length > 0 &&
      !paymentMethods.some((method) => method.id === paymentMethod)
    ) {
      const preferredMethod =
        paymentMethods.find((method) => method.id === "CASH") ||
        paymentMethods[0];
      setPaymentMethod(preferredMethod.id);
    }
  }, [paymentMethod, paymentMethods, setPaymentMethod]);

  // ── Product Sync ───────────────────────────────────────────────────────
  const handleSyncProducts = useCallback(async () => {
    setIsSyncingProducts(true);
    try {
      await syncProducts();
      await fetchProducts();
    } catch (error) {
      console.error("[POS] Lỗi đồng bộ sản phẩm:", error);
    } finally {
      setIsSyncingProducts(false);
    }
  }, [fetchProducts]);

  // ── Add to Cart ────────────────────────────────────────────────────────
  const handleAddToCart = useCallback(
    (product: Product) => {
      // Dùng afterTaxPrice (giá sau thuế) cho giỏ hàng
      const displayPrice = product.afterTaxPrice > 0
        ? product.afterTaxPrice
        : product.price;
      addItem({
        goodsId: product.goodsId,
        goodsName: product.goodsName,
        price: displayPrice,
        quantity: 1,
      });
      if (cartItems.length === 0 && effectiveWarehouseId) {
        void prepareCurrentOrder(shopId, effectiveWarehouseId);
      }
    },
    [
      addItem,
      cartItems.length,
      effectiveWarehouseId,
      prepareCurrentOrder,
      shopId,
    ]
  );

  useEffect(() => {
    if (
      !currentOrderId ||
      !["LOCAL_PAID", "SYNCING"].includes(currentOrderStatus || "")
    ) {
      return;
    }

    void refreshCurrentOrderStatus();
    const intervalId = window.setInterval(() => {
      void refreshCurrentOrderStatus();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [currentOrderId, currentOrderStatus, refreshCurrentOrderStatus]);

  // ── Checkout ───────────────────────────────────────────────────────────
  const handleCheckout = useCallback(async () => {
    if (!effectiveWarehouseId) {
      const error = new Error("Chưa xác định được điểm bán.");
      showError(
        "Không thể thanh toán",
        "Vui lòng chọn điểm bán trước khi thanh toán.",
      );
      throw error;
    }

    const runCheckout = () => checkout(shopId, effectiveWarehouseId);
    const notifyCheckout = (): ReturnType<typeof runCheckout> => {
      return showPromise(runCheckout(), {
        loading: "Đang ghi nhận thanh toán...",
        success: "Thanh toán thành công",
        error: "Không thể thanh toán",
        successDescription:
          "Đơn đã được lưu trên Firebase. Hệ thống đang đồng bộ nền.",
        errorDescription:
          "Đơn chưa được ghi nhận. Vui lòng kiểm tra kết nối và thử lại.",
        onRetry: () => {
          void notifyCheckout();
        },
      });
    };

    try {
      await notifyCheckout();
    } catch (error: unknown) {
      console.error("[POS] Lỗi thanh toán:", error);
      throw error;
    }
  }, [effectiveWarehouseId, checkout, shopId]);

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
  if (needsWarehouseSelection) {
    return (
      <StoreSelector
        userName={userDoc.full_name}
        warehouses={availableWarehouses}
        onSelectWarehouse={selectWarehouse}
        onLogout={logout}
      />
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--color-background)]">
      <Sidebar onLogout={logout} />

      {/* Center: welcome, search, categories and products */}
      <main className="flex-1 flex flex-col min-w-0">
        <TopNav
          storeName={effectiveWarehouseName || "Điểm làm việc"}
          cashierName={userDoc.full_name}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSyncProducts={handleSyncProducts}
          isSyncing={isSyncingProducts}
        />

        <div className="flex-1 min-h-0">
          <ProductGrid
            products={products}
            availableCategories={availableCategories}
            selectedCategory={selectedCategory}
            isLoading={isProductsLoading}
            onSelectCategory={setSelectedCategory}
            onAddToCart={handleAddToCart}
          />
        </div>
      </main>

      {/* Right: fixed order panel */}
      <div className="w-[350px] xl:w-[380px] shrink-0">
        <CartPanel
          items={cartItems}
          paymentMethod={paymentMethod}
          paymentMethods={paymentMethods}
          isCheckingOut={isCheckingOut}
          currentOrderId={currentOrderId}
          currentHkOrderNumber={currentHkOrderNumber}
          currentOrderStatus={currentOrderStatus}
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
  );
}
