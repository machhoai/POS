import type { Product } from "@/lib/types/product";

const SOUVENIR_CATEGORY_ID = 10;

function includesQuery(value: string | undefined, query: string): boolean {
  return value?.toLowerCase().includes(query) ?? false;
}

function matchesSouvenirCode(product: Product, query: string): boolean {
  return (
    product.category === SOUVENIR_CATEGORY_ID &&
    (includesQuery(product.barCode, query) ||
      includesQuery(product.giftNo, query))
  );
}

function matchesProductText(product: Product, query: string): boolean {
  return (
    includesQuery(product.goodsName, query) ||
    includesQuery(product.typeName, query)
  );
}

export function filterProducts(
  products: Product[],
  selectedCategory: number | null,
  searchQuery: string,
): Product[] {
  const query = searchQuery.toLowerCase().trim();

  return products.filter((product) => {
    const matchesCategory =
      selectedCategory === null || product.category === selectedCategory;

    if (!query) {
      return matchesCategory;
    }

    return (
      matchesSouvenirCode(product, query) ||
      (matchesCategory && matchesProductText(product, query))
    );
  });
}
