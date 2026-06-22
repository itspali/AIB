import Link from "next/link";
import {
  Building2,
  Clock,
  AlertTriangle,
  UserPlus,
  Users,
  Ban,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { HubSectionHeading } from "@/components/dashboard/hub-panel";
import { ActionQueuePanel, type ActionQueueItem } from "@/components/console/action-queue-panel";
import { ConsoleHubHeader } from "@/components/console/console-hub-header";
import { SignupFunnelBar } from "@/components/console/signup-funnel-bar";
import { ConsoleDataTable } from "@/components/console/console-data-table";
import { requireConsoleAccess } from "@/lib/console/require-console";
import { fetchOverviewMetrics } from "@/lib/console/queries/overview-metrics";
import { fetchSignupPipeline } from "@/lib/console/queries/signup-pipeline";
import { fetchAuditLog } from "@/lib/console/queries/audit-log";
import type { PipelineStage } from "@/lib/console/types";
import type { SignupPipelineFunnel } from "@/lib/console/queries/signup-pipeline";

const FUNNEL_STAGES: PipelineStage[] = [
  "REGISTERED",
  "EMAIL_VERIFIED",
  "TENANT_CREATED",
  "LIVE",
  "TRIAL",
  "PAYING",
];

function buildFunnelSteps(funnel: SignupPipelineFunnel, stuckOnboarding: number) {
  return FUNNEL_STAGES.map((stage, index) => {
    const count = funnel[stage];
    const prevCount = index > 0 ? funnel[FUNNEL_STAGES[index - 1]!] : null;
    const conversionPercent =
      prevCount && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;

    return {
      stage,
      count,
      conversionPercent,
      stuckCount: stage === "TENANT_CREATED" ? stuckOnboarding : undefined,
    };
  });
}

function buildActionQueue(metrics: Awaited<ReturnType<typeof fetchOverviewMetrics>>): ActionQueueItem[] {
  const items: ActionQueueItem[] = [];
  const { stuckSignups, trialsExpiring7d, suspendedTenants } = metrics;

  if (stuckSignups.bucketA > 0) {
    items.push({
      id: "stuck-a",
      title: `${stuckSignups.bucketA} deferred signup${stuckSignups.bucketA === 1 ? "" : "s"}`,
      subtitle: "Provision not finished after registration",
      issueLabel: "Issue A",
      href: "/console/signups?issue=A",
      actionLabel: "Review signups",
      severity: "violet",
    });
  }

  if (stuckSignups.bucketB > 0) {
    items.push({
      id: "stuck-b",
      title: `${stuckSignups.bucketB} onboarding${stuckSignups.bucketB === 1 ? "" : "s"} without locations`,
      subtitle: "Wizard incomplete — no tenant locations",
      issueLabel: "Issue B",
      href: "/console/signups?issue=B",
      actionLabel: "Review signups",
      severity: "amber",
    });
  }

  if (stuckSignups.bucketC > 0) {
    items.push({
      id: "stuck-c",
      title: `${stuckSignups.bucketC} provisioning mismatch${stuckSignups.bucketC === 1 ? "" : "es"}`,
      subtitle: "Auth metadata without public user row",
      issueLabel: "Issue C",
      href: "/console/signups?issue=C",
      actionLabel: "Review signups",
      severity: "violet",
    });
  }

  if (trialsExpiring7d > 0) {
    items.push({
      id: "trials-expiring",
      title: `${trialsExpiring7d} trial${trialsExpiring7d === 1 ? "" : "s"} expiring in 7 days`,
      subtitle: "Trials ending soon need operator follow-up",
      href: "/console/trials?view=expiring_7d",
      actionLabel: "View trials",
      severity: "amber",
    });
  }

  if (suspendedTenants > 0) {
    items.push({
      id: "suspended",
      title: `${suspendedTenants} suspended tenant${suspendedTenants === 1 ? "" : "s"}`,
      subtitle: "Accounts blocked or marked suspended",
      href: "/console/tenants?status=SUSPENDED",
      actionLabel: "View tenants",
      severity: "amber",
    });
  }

  return items;
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function ConsoleOverviewPage() {
  const { admin } = await requireConsoleAccess("VIEWER");

  const [metrics, pipeline, audit] = await Promise.all([
    fetchOverviewMetrics(admin),
    fetchSignupPipeline(admin, { limit: 1 }),
    fetchAuditLog(admin, { limit: 5 }),
  ]);

  const stuckTotal =
    metrics.stuckSignups.bucketA + metrics.stuckSignups.bucketB + metrics.stuckSignups.bucketC;

  const funnelSteps = buildFunnelSteps(pipeline.funnel, metrics.stuckOnboarding);
  const queueItems = buildActionQueue(metrics);

  return (
    <div className="canvas-scroll-endpad space-y-10">
      <ConsoleHubHeader
        pills={[
          {
            label: `${metrics.activeTenants} tenants live`,
            href: "/console/tenants?status=ACTIVE",
            tone: "emerald",
          },
          {
            label: `${metrics.trialsExpiring7d} trials expiring`,
            href: "/console/trials?view=expiring_7d",
            tone: "amber",
          },
          {
            label: `${stuckTotal} signups stuck`,
            href: "/console/signups?issue=any",
            tone: "violet",
          },
        ]}
      />

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

      <section aria-label="Signup funnel">
        <HubSectionHeading
          step="1"
          title="Signup funnel"
          description="Stage counts with conversion from the previous step. Click a stage to filter the pipeline."
        />
        <SignupFunnelBar steps={funnelSteps} />
      </section>

      <ActionQueuePanel items={queueItems} />

      <section aria-label="Recent operator activity">
        <HubSectionHeading
          step="2"
          title="Recent activity"
          description="Latest audited console actions."
        />
        {audit.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No console activity recorded yet.</p>
        ) : (
          <ConsoleDataTable>
            <thead>
              <tr>
                <th className="text-left">When</th>
                <th className="text-left">Operator</th>
                <th className="text-left">Action</th>
                <th className="text-left">Target</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-muted-foreground">{formatWhen(row.created_at)}</td>
                  <td>{row.operator_email}</td>
                  <td>{row.action}</td>
                  <td>
                    {row.tenant_id ? (
                      <Link
                        href={`/console/tenants/${row.tenant_id}`}
                        className="text-primary hover:underline"
                      >
                        {row.target_type}
                      </Link>
                    ) : (
                      row.target_type
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </ConsoleDataTable>
        )}
        <p className="mt-3 text-sm">
          <Link href="/console/audit" className="text-primary hover:underline">
            View full audit log →
          </Link>
        </p>
      </section>
    </div>
  );
}
