import { fetchCategoryRows } from "@/lib/categories/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { resolveProductCatalogInitialState } from "@/lib/products/catalog-initial-state";
import { loadUserProductListPrefs } from "@/lib/products/list-prefs-server";
import { ProductCatalogTerminal } from "@/components/products/product-catalog-terminal";

export async function ProductCatalogLoader() {
  const { supabase, tenantId, userId, operatorRole } = await getModulePageContext();

  const [categories, initialListPrefs, catalogState] = await Promise.all([
    fetchCategoryRows(supabase, tenantId),
    loadUserProductListPrefs(supabase, userId, tenantId),
    loadUserProductListPrefs(supabase, userId, tenantId).then((prefs) =>
      resolveProductCatalogInitialState(supabase, tenantId, userId, operatorRole, prefs)
    ),
  ]);

  return (
    <ProductCatalogTerminal
      tenantId={tenantId}
      initialProducts={catalogState.products}
      listTotalCount={catalogState.totalCount}
      listHasMore={catalogState.hasMore}
      initialSavedView={catalogState.initialSavedView}
      initialFilteredItemIds={catalogState.initialFilteredItemIds}
      categories={categories}
      fieldPermissions={catalogState.fieldPermissions}
      initialListPrefs={initialListPrefs}
    />
  );
}
