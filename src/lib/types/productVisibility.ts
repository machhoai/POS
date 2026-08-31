export interface ProductVisibilitySettings {
  id: string;
  warehouse_id: string;
  version: number;
  disabled_group_keys: string[];
  disabled_product_ids: string[];
}

export interface ProductVisibilityCatalogItem {
  goods_id: string;
  goods_name: string;
  category: number;
  group_key: string;
  group_name: string;
  type_id: string | null;
}

export interface ProductVisibilityView {
  settings: ProductVisibilitySettings | null;
  products: ProductVisibilityCatalogItem[];
}

