import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ApprovalCommandCenter } from "@/components/approvals/approval-command-center";
import { fetchMyApprovalTasks } from "@/lib/approvals/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function ApprovalsPage() {
  const { supabase, orgName, approvalAlertCount, operatorProfile, tenantId } =
    await getModulePageContext();

  const tasks = await fetchMyApprovalTasks(supabase, 50);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <ApprovalCommandCenter tasks={tasks} />
    </DashboardShell>
  );
}
