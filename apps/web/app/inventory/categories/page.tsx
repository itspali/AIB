import { fetchCategoryRows } from "@/lib/categories/queries";
import { CategoryManagementTerminal } from "@/components/categories/category-management-terminal";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function InventoryCategoriesPage() {
  const { supabase, tenantId } = await getModulePageContext();
  const rows = await fetchCategoryRows(supabase, tenantId);

  return <CategoryManagementTerminal initialRows={rows} />;
}
