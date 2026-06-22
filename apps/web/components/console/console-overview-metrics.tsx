"use client";

import {
  AlertTriangle,
  Ban,
  Building2,
  Clock,
  UserPlus,
  Users,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import type { OverviewMetrics } from "@/lib/console/queries/overview-metrics";

type Props = {
  metrics: OverviewMetrics;
};

export function ConsoleOverviewMetrics({ metrics }: Props) {
  return (
    <section aria-label="Platform metrics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Active tenants"
          value={String(metrics.activeTenants)}
          subtitle={`${metrics.totalTenants} total workspaces`}
          icon={Building2}
          accent="emerald"
          href="/console/tenants?status=ACTIVE"
        />
        <MetricCard
          title="On trial"
          value={String(metrics.trialTenants)}
          subtitle={`${metrics.trialsExpiring7d} expiring in 7d`}
          icon={Clock}
          accent="amber"
          href="/console/trials"
        />
        <MetricCard
          title="Signups (7d)"
          value={String(metrics.signups7d)}
          subtitle="New registrations this week"
          icon={UserPlus}
          accent="cyan"
          href="/console/signups"
        />
        <MetricCard
          title="Stuck onboarding"
          value={String(metrics.stuckOnboarding)}
          subtitle="Not go-live ready or missing locations"
          icon={AlertTriangle}
          accent="violet"
          href="/console/signups?issue=B"
        />
        <MetricCard
          title="Suspended"
          value={String(metrics.suspendedTenants)}
          subtitle="Inactive or suspended accounts"
          icon={Ban}
          accent="amber"
          href="/console/tenants?status=SUSPENDED"
        />
        <MetricCard
          title="Total tenants"
          value={String(metrics.totalTenants)}
          subtitle="All workspaces on platform"
          icon={Users}
          accent="cyan"
          href="/console/tenants"
        />
      </div>
    </section>
  );
}
