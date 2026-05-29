import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CommandHubHeader } from "@/components/dashboard/command-hub-header";
import { MetricGaugeGrid } from "@/components/dashboard/metric-gauge-grid";
import { ControlPanelSection } from "@/components/dashboard/control-panel-section";
import { TaxPolicySection } from "@/components/dashboard/tax-policy-section";
import {
  ControlPanelSkeleton,
  MetricGaugeSkeleton,
  TaxPolicyGridSkeleton,
} from "@/components/dashboard/dashboard-skeletons";

export default async function DashboardPage() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const snapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!snapshot) redirect("/signup");

  if (!snapshot.isOnboardingComplete) redirect("/onboarding");

  const orgName = snapshot.tenant.trade_name || snapshot.tenant.name;

  const [approvalAlertCount, operatorProfile] = await Promise.all([
    fetchApprovalAlertCount(supabase, tenantId),
    fetchOperatorProfileForSession(supabase, orgName),
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
