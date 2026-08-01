// =============================================================================
// Zustand Product Store — In-memory product catalog
// =============================================================================
// Hiện tại dùng mock data vì chưa kết nối HK API.
// Khi API sẵn sàng, chỉ cần thay MOCK_PRODUCTS bằng Firestore fetch.
// =============================================================================

import { create } from "zustand";
import type { Product } from "@/lib/types/product";
import { CATEGORY_MAP } from "@/lib/types/product";
import { filterProducts } from "@/lib/utils/productSearch";
import {
  getProducts,
  type StoredProduct,
} from "@/lib/services/productService";

/** Một entry danh mục đã derive từ danh sách sản phẩm. */
export interface CategoryEntry {
  id: number;
  label: string;
}

/** Shape của product store. */
interface ProductState {
  // ── State ──────────────────────────────────────────────────────────────────
  products: Product[];
  /** Danh mục có ít nhất 1 sản phẩm */
  availableCategories: CategoryEntry[];
  /** Lọc theo danh mục (null = tất cả) */
  selectedCategory: number | null;
  searchQuery: string;
  isLoading: boolean;
  lastSyncAt: string | null;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  /** Tải sản phẩm (hiện dùng mock data) */
  fetchProducts: () => Promise<void>;
  /** Chọn danh mục lọc */
  setSelectedCategory: (category: number | null) => void;
  /** Tìm kiếm */
  setSearchQuery: (query: string) => void;
  /** Xóa bộ lọc */
  clearFilters: () => void;
}

/**
 * Derive danh mục có sản phẩm từ danh sách.
 * Giữ thứ tự ổn định theo CATEGORY_MAP.
 */
function deriveCategories(products: Product[]): CategoryEntry[] {
  const seen = new Set<number>();
  const result: CategoryEntry[] = [];

  for (const product of products) {
    if (!seen.has(product.category) && CATEGORY_MAP[product.category]) {
      seen.add(product.category);
      result.push({
        id: product.category,
        label: CATEGORY_MAP[product.category],
      });
    }
  }

  return result;
}

function toProduct(source: StoredProduct): Product {
  const price = Number(source.price);
  const storedAfterTaxPrice = Number(source.afterTaxPrice);
  const afterTaxPrice = Number.isFinite(storedAfterTaxPrice)
    ? storedAfterTaxPrice
    : price;

  return {
    goodsId: String(source.goodsId),
    goodsName: String(source.goodsName),
    description: source.description || "",
    price,
    afterTaxPrice,
    underlinePrice: 0,
    category: Number(source.category),
    subCategory: source.subCategory || "",
    typeId: "",
    typeName: source.typeName || source.subCategory || "",
    foreColor: "#FFFFFF",
    backColor: "#2563EB",
    taxRate: 0,
    isOpenSales: true,
    isEnabled: true,
    amount: Number.isFinite(Number(source.amount))
      ? Number(source.amount)
      : 0,
    giftNo: source.giftNo,
    lastSyncAt: source.lastSyncAt || undefined,
  };
}

/**
 * Product store — tải tất cả sản phẩm vào RAM để filter không độ trễ.
 */
export const useProductStore = create<ProductState>((set) => ({
  // ── Initial State ──────────────────────────────────────────────────────────
  products: [],
  availableCategories: [],
  selectedCategory: null,
  searchQuery: "",
  isLoading: false,
  lastSyncAt: null,
  error: null,

  // ── Actions ────────────────────────────────────────────────────────────────

  fetchProducts: async () => {
    set({ isLoading: true, error: null });

    try {
      const result = await getProducts();
      const products = result.products
        .map(toProduct)
        .filter(
          (product) =>
            Boolean(CATEGORY_MAP[product.category]) &&
            Number.isFinite(product.price) &&
            Number.isFinite(product.afterTaxPrice) &&
            (product.category !== 10 || product.afterTaxPrice > 0)
        );

      const categories = deriveCategories(products);
      const lastSyncAt =
        products
          .map((product) => product.lastSyncAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) || result.fetchedAt;

      set((state) => ({
        products,
        availableCategories: categories,
        selectedCategory:
          state.selectedCategory !== null &&
          categories.some((category) => category.id === state.selectedCategory)
            ? state.selectedCategory
            : categories[0]?.id ?? null,
        isLoading: false,
        lastSyncAt,
        error: null,
      }));
    } catch (error) {
      console.error("[Product Store] Lỗi khi tải sản phẩm:", error);
      set({
        isLoading: false,
        error: "Không thể tải danh sách sản phẩm. Vui lòng thử lại.",
      });
    }
  },

  setSelectedCategory: (category) =>
    set({ selectedCategory: category }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  clearFilters: () => set({ selectedCategory: null, searchQuery: "" }),
}));

// =============================================================================
// Selectors — Derived data computed from store state
// =============================================================================

/**
 * Select sản phẩm đã lọc theo danh mục và tìm kiếm.
 */
export const selectFilteredProducts = (state: ProductState): Product[] => {
  return filterProducts(
    state.products,
    state.selectedCategory,
    state.searchQuery,
  );
};
