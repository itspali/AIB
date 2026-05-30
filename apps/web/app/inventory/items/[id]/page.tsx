import { notFound } from "next/navigation";
import { fetchCategoryRows } from "@/lib/categories/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchProductCatalogContext } from "@/lib/products/commerce-queries";
import { fetchProductDetail } from "@/lib/products/queries";
import { ProductFormRoute } from "@/components/products/product-form-route";

export default async function ViewItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, tenantId } = await getModulePageContext();

  const [categories, catalogContext, detail] = await Promise.all([
    fetchCategoryRows(supabase, tenantId),
    fetchProductCatalogContext(supabase, tenantId),
    fetchProductDetail(supabase, tenantId, id),
  ]);

  if (!detail) notFound();

  return (
    <ProductFormRoute
      mode="view"
      tenantId={tenantId}
      categories={categories}
      catalogContext={catalogContext}
      detail={detail}
    />
  );
}
