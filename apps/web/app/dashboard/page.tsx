import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionTenantId } from "@/lib/supabase/auth";
import { fetchOnboardingSnapshot, hasWorkspaceAccess } from "@/lib/onboarding/status";
import { fetchApprovalAlertCount, fetchPendingPurchaseOrderApprovals } from "@/lib/dashboard/queries";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CommandHubHeader } from "@/components/dashboard/command-hub-header";
import { ApprovalQueuePanel } from "@/components/dashboard/approval-queue-panel";
import { GettingStartedChecklist } from "@/components/dashboard/getting-started-checklist";
import { MetricGaugeGrid } from "@/components/dashboard/metric-gauge-grid";
import { fetchGettingStartedSnapshot } from "@/lib/dashboard/getting-started";
import { ControlPanelSection } from "@/components/dashboard/control-panel-section";
import { TaxPolicySection } from "@/components/dashboard/tax-policy-section";
import {
  ControlPanelSkeleton,
  MetricGaugeSkeleton,
  TaxPolicyGridSkeleton,
} from "@/components/dashboard/dashboard-skeletons";

export default async function DashboardPage() {
  const [supabase, tenantId] = await Promise.all([createClient(), getSessionTenantId()]);

  if (!tenantId) redirect("/signup");

  const snapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!snapshot) redirect("/signup");

  if (!hasWorkspaceAccess(snapshot)) redirect("/onboarding");

  const orgName = snapshot.tenant.trade_name || snapshot.tenant.name;

  const [approvalAlertCount, operatorProfile, gettingStarted, pendingPurchaseOrderApprovals] =
    await Promise.all([
    fetchApprovalAlertCount(supabase, tenantId),
    fetchOperatorProfileForSession(supabase, orgName),
    fetchGettingStartedSnapshot(supabase, tenantId),
    fetchPendingPurchaseOrderApprovals(supabase, tenantId),
  ]);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <div className="canvas-scroll-endpad">
        <CommandHubHeader approvalAlertCount={approvalAlertCount} />

        <ApprovalQueuePanel pendingPurchaseOrders={pendingPurchaseOrderApprovals} />

        <GettingStartedChecklist snapshot={gettingStarted} />

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
    </DashboardShell>
  );
}
