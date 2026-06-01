import { notFound } from "next/navigation";
import { fetchCategoryRows } from "@/lib/categories/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchProductCatalogContext } from "@/lib/products/commerce-queries";
import { fetchProductDetail } from "@/lib/products/queries";
import { ProductFormRouteWithSuspense } from "@/components/products/product-form-route";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, tenantId } = await getModulePageContext();

  const [categories, catalogContext, detail, editability] = await Promise.all([
    fetchCategoryRows(supabase, tenantId),
    fetchProductCatalogContext(supabase, tenantId),
    fetchProductDetail(supabase, tenantId, id),
    supabase.rpc("item_editability", { p_item_id: id }),
  ]);

  if (!detail) notFound();

  const editabilityData = editability.data as { locked_fields?: unknown } | null;
  const lockedFields = Array.isArray(editabilityData?.locked_fields)
    ? (editabilityData.locked_fields as string[])
    : [];

  return (
    <ProductFormRouteWithSuspense
      mode="edit"
      tenantId={tenantId}
      categories={categories}
      catalogContext={catalogContext}
      detail={detail}
      lockedFields={lockedFields}
    />
  );
}
