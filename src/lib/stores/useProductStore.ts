// =============================================================================
// Zustand Product Store — In-memory product catalog
// =============================================================================
// Hiện tại dùng mock data vì chưa kết nối HK API.
// Khi API sẵn sàng, chỉ cần thay MOCK_PRODUCTS bằng Firestore fetch.
// =============================================================================

import { create } from "zustand";
import type { Product } from "@/lib/types/product";
import { CATEGORY_MAP } from "@/lib/types/product";
import { MOCK_PRODUCTS } from "@/lib/data/mockProducts";

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
      // TODO: Thay bằng Firestore fetch khi HK API sẵn sàng
      // const snapshot = await getDocs(collection(db, "jpos_products"));
      // Hiện tại dùng mock data
      const products = MOCK_PRODUCTS;

      const categories = deriveCategories(products);

      set((state) => ({
        products,
        availableCategories: categories,
        // Tự động chọn tab đầu tiên nếu chưa chọn
        selectedCategory:
          state.selectedCategory !== null
            ? state.selectedCategory
            : categories[0]?.id ?? null,
        isLoading: false,
        lastSyncAt: new Date().toISOString(),
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
  let filtered = state.products;

  // Lọc theo danh mục
  if (state.selectedCategory !== null) {
    filtered = filtered.filter(
      (p) => p.category === state.selectedCategory
    );
  }

  // Lọc theo tìm kiếm (tên + typeName)
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (p) =>
        p.goodsName.toLowerCase().includes(q) ||
        p.typeName.toLowerCase().includes(q)
    );
  }

  return filtered;
};
