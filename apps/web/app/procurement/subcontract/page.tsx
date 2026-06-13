import { SubcontractManagementTerminal } from "@/components/procurement/subcontract/subcontract-management-terminal";
import { loadSubcontractAdminContext } from "@/app/procurement/subcontract/actions";

export default async function SubcontractPage() {
  const initialContext = await loadSubcontractAdminContext();

  return <SubcontractManagementTerminal initialContext={initialContext} />;
}
