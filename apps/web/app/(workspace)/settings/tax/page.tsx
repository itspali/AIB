import { TaxSettingsTerminal } from "@/components/settings/tax-settings-terminal";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { getModulePageContext } from "@/lib/layout/module-page";
import { resolveTaxSettingsAccess } from "@/lib/tax/access";
import { fetchTaxCodeRows } from "@/lib/tax/queries";

export default async function TaxSettingsPage() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [rows, access] = await Promise.all([
    fetchTaxCodeRows(supabase, tenantId),
    resolveTaxSettingsAccess(supabase, userId, tenantId),
  ]);

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId="settings-tax">
      <TaxSettingsTerminal initialRows={rows} canEdit={access.granted} />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
