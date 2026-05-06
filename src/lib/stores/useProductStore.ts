// =============================================================================
// Zustand Product Store — In-memory product catalog with Firestore sync
// =============================================================================
// Fetches all products from Firestore's `products` collection into RAM.
// Categories are derived from the `category` field using CATEGORY_MAP.
// Provides category filtering and search functionality.
// =============================================================================

import { create } from "zustand";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Product } from "@/lib/types/product";
import { CATEGORY_MAP } from "@/lib/types/product";

/** A category entry derived from product data. */
export interface CategoryEntry {
  id: number;
  label: string;
}

/** Shape of the product store state. */
interface ProductState {
  // ── State ──────────────────────────────────────────────────────────────────
  products: Product[];
  /** Categories that have at least one product (computed on fetch) */
  availableCategories: CategoryEntry[];
  /** Currently selected category filter (null = show all) */
  selectedCategory: number | null;
  searchQuery: string;
  isLoading: boolean;
  lastSyncAt: string | null;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  /** Fetch all products from Firestore */
  fetchProducts: () => Promise<void>;
  /** Set the active category filter */
  setSelectedCategory: (category: number | null) => void;
  /** Set the search query */
  setSearchQuery: (query: string) => void;
  /** Clear all filters */
  clearFilters: () => void;
}

/** Firestore collection name */
const PRODUCTS_COLLECTION = "products";

/**
 * Derive unique category entries from the product list.
 * Returns a stable array that only changes when products change.
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
 * Product store — fetches all products into RAM for zero-latency filtering.
 * Categories are derived from product data, not stored separately.
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
      const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));

      // 🔍 DEBUG: Log raw Firestore data
      console.log(`[Product Store] 🔍 Loaded ${snapshot.docs.length} docs from Firestore`);
      if (snapshot.docs.length > 0) {
        const firstDoc = snapshot.docs[0];
        console.log("[Product Store] 🔍 FIRST DOC id:", firstDoc.id);
        console.log("[Product Store] 🔍 FIRST DOC data:", JSON.stringify(firstDoc.data()));
      }

      const products: Product[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          goodsId: data.goodsId || doc.id,
          goodsName: data.goodsName || "Không rõ tên",
          price: data.price || 0,
          category: data.category || 0,
          subCategory: data.subCategory || "",
          lastSyncAt: data.lastSyncAt,
        };
      });

      set({
        products,
        availableCategories: deriveCategories(products),
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

  setSelectedCategory: (category) =>
    set({ selectedCategory: category }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  clearFilters: () => set({ selectedCategory: null, searchQuery: "" }),
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
  if (state.selectedCategory !== null) {
    filtered = filtered.filter(
      (p) => p.category === state.selectedCategory
    );
  }

  // Filter by search query (name only)
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase().trim();
    filtered = filtered.filter((p) =>
      p.goodsName.toLowerCase().includes(q)
    );
  }

  return filtered;
};
