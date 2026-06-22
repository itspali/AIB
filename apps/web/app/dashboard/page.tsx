import { Suspense } from "react";
import { CommandHubHeader } from "@/components/dashboard/command-hub-header";
import { SetupReminderBanner } from "@/components/dashboard/setup-reminder-banner";
import { ApprovalQueuePanel } from "@/components/dashboard/approval-queue-panel";
import { GettingStartedChecklistLazy } from "@/components/dashboard/getting-started-checklist-lazy";
import { MetricGaugeGrid } from "@/components/dashboard/metric-gauge-grid";
import { fetchGettingStartedSnapshot } from "@/lib/dashboard/getting-started";
import { getAppShellBootstrap } from "@/lib/layout/app-shell-bootstrap";
import { ControlPanelSection } from "@/components/dashboard/control-panel-section";
import { TaxPolicySection } from "@/components/dashboard/tax-policy-section";
import {
  ControlPanelSkeleton,
  MetricGaugeSkeleton,
  TaxPolicyGridSkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import { fetchApprovalAlertCount, fetchPendingPurchaseOrderApprovals } from "@/lib/dashboard/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function DashboardPage() {
  const { supabase, tenantId } = await getModulePageContext();
  const bootstrap = await getAppShellBootstrap();

  const [approvalAlertCount, gettingStarted, pendingPurchaseOrderApprovals] =
    await Promise.all([
      fetchApprovalAlertCount(supabase, tenantId),
      fetchGettingStartedSnapshot(supabase, tenantId),
      fetchPendingPurchaseOrderApprovals(supabase, tenantId),
    ]);

  const showSetupReminder =
    bootstrap.hasWorkspaceAccess && !bootstrap.financeSetupComplete;

  return (
    <div className="canvas-scroll-endpad">
      <CommandHubHeader approvalAlertCount={approvalAlertCount} />

      <ApprovalQueuePanel pendingPurchaseOrders={pendingPurchaseOrderApprovals} />

      {showSetupReminder ? (
        <SetupReminderBanner />
      ) : null}

      <GettingStartedChecklistLazy snapshot={gettingStarted} />

      <Suspense fallback={<MetricGaugeSkeleton />}>
        <MetricGaugeGrid />
      </Suspense>

      <Suspense fallback={<ControlPanelSkeleton />}>
        <ControlPanelSection />
      </Suspense>

      <Suspense fallback={<TaxPolicyGridSkeleton />}>
        <TaxPolicySection />
      </Suspense>
    </div>
  );
}
