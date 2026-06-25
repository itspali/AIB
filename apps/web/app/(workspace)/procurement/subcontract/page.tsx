import { SubcontractManagementTerminal } from "@/components/procurement/subcontract/subcontract-management-terminal";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { loadSubcontractAdminContext } from "@/app/procurement/subcontract/actions";

export default async function SubcontractPage() {
  const initialContext = await loadSubcontractAdminContext();

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId="procurement-subcontract">
      <SubcontractManagementTerminal initialContext={initialContext} />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
