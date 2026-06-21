import dynamic from "next/dynamic";
import { getModulePageContext } from "@/lib/layout/module-page";
import { resolveProductCatalogInitialState } from "@/lib/products/catalog-initial-state";
import { loadUserProductListPrefs } from "@/lib/products/list-prefs-server";
import { ProductCatalogPageSkeleton } from "@/components/products/product-catalog-page-skeleton";

const ProductCatalogTerminal = dynamic(
  () =>
    import("@/components/products/product-catalog-terminal").then(
      (module) => module.ProductCatalogTerminal
    ),
  { loading: () => <ProductCatalogPageSkeleton /> }
);

export async function ProductCatalogLoader() {
  const { supabase, tenantId, userId, operatorRole } = await getModulePageContext();
  const prefsPromise = loadUserProductListPrefs(supabase, userId, tenantId);

  const [initialListPrefs, catalogState] = await Promise.all([
    prefsPromise,
    prefsPromise.then((prefs) =>
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
      fieldPermissions={catalogState.fieldPermissions}
      initialListPrefs={initialListPrefs}
    />
  );
}
