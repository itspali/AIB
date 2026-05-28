import type { ProductCatalogContext, ProductMasterFormValues } from "@/lib/products/types";

export function mergeStorefrontVisibility(
  storefronts: ProductCatalogContext["storefronts"],
  saved: ProductMasterFormValues["storefront_visibility"]
): ProductMasterFormValues["storefront_visibility"] {
  const savedById = new Map(saved.map((row) => [row.storefront_id, row]));

  return storefronts.map((storefront) => {
    const existing = savedById.get(storefront.id);
    return (
      existing ?? {
        storefront_id: storefront.id,
        is_visible: false,
        store_custom_name: "",
        store_price_book_id: null,
      }
    );
  });
}

export function buildDefaultStorefrontVisibility(
  storefronts: ProductCatalogContext["storefronts"]
): ProductMasterFormValues["storefront_visibility"] {
  return mergeStorefrontVisibility(storefronts, []);
}
