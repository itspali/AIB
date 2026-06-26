import { Suspense } from "react";
import { CommandHubHeader } from "@/components/dashboard/command-hub-header";
import { OverviewGlassShell } from "@/components/layout/overview-glass-shell";
import { SetupReminderBanner } from "@/components/dashboard/setup-reminder-banner";
import { GettingStartedChecklistLazy } from "@/components/dashboard/getting-started-checklist-lazy";
import { MetricGaugeGrid } from "@/components/dashboard/metric-gauge-grid";
import { NeedsAttentionSection } from "@/components/dashboard/needs-attention-section";
import { DashboardModuleShortcuts } from "@/components/dashboard/dashboard-module-shortcuts";
import { WorkspaceStatusSection } from "@/components/dashboard/workspace-status-section";
import { fetchGettingStartedSnapshot } from "@/lib/dashboard/getting-started";
import { fetchDashboardAttentionItems } from "@/lib/dashboard/attention";
import { getAppShellBootstrap } from "@/lib/layout/app-shell-bootstrap";
import {
  MetricGaugeSkeleton,
  WorkspaceStatusSkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function DashboardPage() {
  const { supabase, tenantId, orgName } = await getModulePageContext();
  const bootstrap = await getAppShellBootstrap();

  const [approvalAlertCount, gettingStarted, attentionItems] = await Promise.all([
    fetchApprovalAlertCount(supabase, tenantId),
    fetchGettingStartedSnapshot(supabase, tenantId),
    fetchDashboardAttentionItems(supabase, tenantId),
  ]);

  const showSetupReminder =
    bootstrap.hasWorkspaceAccess && !bootstrap.financeSetupComplete;

  return (
    <OverviewGlassShell>
      <div className="canvas-scroll-endpad">
        <CommandHubHeader orgName={orgName} approvalAlertCount={approvalAlertCount} />

        {showSetupReminder ? <SetupReminderBanner /> : null}

        <GettingStartedChecklistLazy snapshot={gettingStarted} />

        <Suspense fallback={<MetricGaugeSkeleton />}>
          <MetricGaugeGrid />
        </Suspense>

        <NeedsAttentionSection items={attentionItems} />

        <DashboardModuleShortcuts />

        <Suspense fallback={<WorkspaceStatusSkeleton />}>
          <WorkspaceStatusSection />
        </Suspense>
      </div>
    </OverviewGlassShell>
  );
}
