// =============================================================================
// Zustand Product Store — In-memory product catalog with Firestore sync
// =============================================================================
// Fetches all products from Firestore's `pos_products` collection into RAM.
// Provides category filtering and search functionality.
// Products are synced to Firestore by the `syncProducts` Cloud Function.
// =============================================================================

import { create } from "zustand";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Product, ProductCategory } from "@/lib/types/product";

/** Shape of the product store state. */
interface ProductState {
  // ── State ──────────────────────────────────────────────────────────────────
  products: Product[];
  categories: ProductCategory[];
  selectedCategoryId: string | null;
  searchQuery: string;
  isLoading: boolean;
  lastSyncAt: string | null;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  /** Fetch all products from Firestore for a given store */
  fetchProducts: (storeId: string) => Promise<void>;
  /** Set the active category filter */
  setSelectedCategory: (categoryId: string | null) => void;
  /** Set the search query */
  setSearchQuery: (query: string) => void;
  /** Clear all filters */
  clearFilters: () => void;
}

/** Firestore collection names */
const PRODUCTS_COLLECTION = "pos_products";
const CATEGORIES_COLLECTION = "pos_categories";

/**
 * Product store — fetches all products into RAM for zero-latency filtering.
 * The POS operates on a per-store product set synced from the HK API.
 */
export const useProductStore = create<ProductState>((set) => ({
  // ── Initial State ──────────────────────────────────────────────────────────
  products: [],
  categories: [],
  selectedCategoryId: null,
  searchQuery: "",
  isLoading: false,
  lastSyncAt: null,
  error: null,

  // ── Actions ────────────────────────────────────────────────────────────────

  fetchProducts: async (storeId: string) => {
    set({ isLoading: true, error: null });

    try {
      // Fetch products for this store
      const productsQuery = query(
        collection(db, PRODUCTS_COLLECTION),
        where("storeId", "==", storeId),
        where("isActive", "==", true),
        orderBy("sortOrder", "asc")
      );
      const productsSnapshot = await getDocs(productsQuery);
      const products: Product[] = productsSnapshot.docs.map(
        (doc) => ({ goodsId: doc.id, ...doc.data() }) as Product
      );

      // Fetch categories
      const categoriesQuery = query(
        collection(db, CATEGORIES_COLLECTION),
        where("storeId", "==", storeId),
        orderBy("sortOrder", "asc")
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categories: ProductCategory[] = categoriesSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as ProductCategory
      );

      set({
        products,
        categories,
        isLoading: false,
        lastSyncAt: new Date().toISOString(),
        error: null,
      });
    } catch (error) {
      console.error("[Product Store] Lỗi khi tải sản phẩm:", error);
      set({
        isLoading: false,
        error: "Không thể tải danh sách sản phẩm. Vui lòng thử lại.",
      });
    }
  },

  setSelectedCategory: (categoryId) =>
    set({ selectedCategoryId: categoryId }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  clearFilters: () => set({ selectedCategoryId: null, searchQuery: "" }),
}));

// =============================================================================
// Selectors — Derived data computed from store state
// =============================================================================

/**
 * Select filtered products based on category and search query.
 * Performs in-memory filtering for zero latency.
 */
export const selectFilteredProducts = (state: ProductState): Product[] => {
  let filtered = state.products;

  // Filter by category
  if (state.selectedCategoryId) {
    filtered = filtered.filter(
      (p) => p.categoryId === state.selectedCategoryId
    );
  }

  // Filter by search query (name or barcode)
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (p) =>
        p.goodsName.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }

  return filtered;
};
