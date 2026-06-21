import { ApprovalCommandCenterLazy } from "@/components/approvals/approval-command-center-lazy";
import { fetchMyApprovalTasks } from "@/lib/approvals/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function ApprovalsPage() {
  const { supabase } = await getModulePageContext();
  const tasks = await fetchMyApprovalTasks(supabase, 50);

  return <ApprovalCommandCenterLazy tasks={tasks} />;
}
