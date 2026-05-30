import { fetchCategoryRows } from "@/lib/categories/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchProductCatalogContext } from "@/lib/products/commerce-queries";
import { ProductFormRoute } from "@/components/products/product-form-route";

export default async function NewItemPage() {
  const { supabase, tenantId } = await getModulePageContext();

  const [categories, catalogContext] = await Promise.all([
    fetchCategoryRows(supabase, tenantId),
    fetchProductCatalogContext(supabase, tenantId),
  ]);

  return (
    <ProductFormRoute
      mode="create"
      tenantId={tenantId}
      categories={categories}
      catalogContext={catalogContext}
    />
  );
}
