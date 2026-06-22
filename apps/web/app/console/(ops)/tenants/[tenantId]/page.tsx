import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsoleTenantActions } from "@/components/console/console-tenant-actions";
import { ConsoleImpersonationPanel } from "@/components/console/console-impersonation-panel";
import { ConsoleDataTable } from "@/components/console/console-data-table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireConsoleAccess } from "@/lib/console/require-console";
import { fetchTenantDetail } from "@/lib/console/queries/tenant-detail";
import { fetchAuditLog } from "@/lib/console/queries/audit-log";
import { roleAtLeast } from "@/lib/console/roles";
import type { TenantAccountStatus } from "@/lib/console/types";

type PageProps = {
  params: Promise<{ tenantId: string }>;
};

function tenantStatusVariant(status: TenantAccountStatus): "completed" | "action_required" | "administrative" {
  switch (status) {
    case "ACTIVE":
      return "completed";
    case "TRIAL":
      return "action_required";
    default:
      return "administrative";
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

export default async function ConsoleTenantDetailPage({ params }: PageProps) {
  const { tenantId } = await params;
  const { admin, operator } = await requireConsoleAccess("VIEWER");

  const detail = await fetchTenantDetail(admin, tenantId);
  if (!detail) notFound();

  const audit = await fetchAuditLog(admin, { tenantId, limit: 20 });
  const canOperate = roleAtLeast(operator.role, "OPERATOR");
  const canImpersonateWrite = roleAtLeast(operator.role, "ADMIN");
  const { tenant, users, health, subscription, location_count } = detail;

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{tenant.organization_code}</p>
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={tenantStatusVariant(tenant.status)}>{tenant.status}</Badge>
            {!tenant.is_active ? <Badge variant="administrative">Inactive</Badge> : null}
            <span className="text-sm text-muted-foreground">{tenant.onboarding_status}</span>
          </div>
        </div>
        <Link href="/console/tenants" className="text-sm text-primary hover:underline">
          ← All tenants
        </Link>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(16rem,22rem)]">
            <dl className="surface-panel grid gap-3 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Legal name</dt>
                <dd className="font-medium">{tenant.legal_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Trade name</dt>
                <dd className="font-medium">{tenant.trade_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Primary email</dt>
                <dd className="font-medium">{tenant.primary_email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium">{tenant.primary_phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Country</dt>
                <dd className="font-medium">{tenant.country_code ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Timezone</dt>
                <dd className="font-medium">{tenant.timezone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Onboarding source</dt>
                <dd className="font-medium">{tenant.onboarding_source}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">{formatWhen(tenant.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Locations</dt>
                <dd className="font-medium">{location_count}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Group</dt>
                <dd className="font-medium">
                  {tenant.group_id ? (
                    <Link href={`/console/groups`} className="text-primary hover:underline">
                      View groups
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>

            <aside className="space-y-4">
              <div className="surface-panel p-4">
                <h2 className="mb-3 text-sm font-semibold">Lifecycle actions</h2>
                <ConsoleTenantActions
                  tenantId={tenant.id}
                  status={tenant.status}
                  isActive={tenant.is_active}
                  canOperate={canOperate}
                />
              </div>
              <div className="surface-panel p-4">
                <h2 className="mb-3 text-sm font-semibold">Impersonation</h2>
                <ConsoleImpersonationPanel
                  tenantId={tenant.id}
                  tenantName={tenant.trade_name || tenant.name}
                  canImpersonate={canOperate}
                  canWrite={canImpersonateWrite}
                />
              </div>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="people">
          <ConsoleDataTable>
            <thead>
              <tr>
                <th className="text-left">Name</th>
                <th className="text-left">Email</th>
                <th className="text-left">Role</th>
                <th className="text-left">Status</th>
                <th className="text-left">Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No users in this tenant.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      {[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <Badge variant={user.is_active ? "completed" : "administrative"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground">{formatWhen(user.last_login_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </ConsoleDataTable>
        </TabsContent>

        <TabsContent value="billing">
          {subscription ? (
            <dl className="surface-panel grid gap-3 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium">
                  {subscription.plan?.name ?? "—"} ({subscription.plan?.code ?? "—"})
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant="active">{subscription.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Trial ends</dt>
                <dd className="font-medium">{formatWhen(subscription.trial_ends_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Current period end</dt>
                <dd className="font-medium">{formatWhen(subscription.current_period_end)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Stripe customer</dt>
                <dd className="font-mono text-xs">{subscription.stripe_customer_id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Price</dt>
                <dd className="font-medium">
                  {subscription.plan
                    ? `${subscription.plan.price_currency} ${(subscription.plan.price_amount / 100).toFixed(2)} / ${subscription.plan.billing_interval.toLowerCase()}`
                    : "—"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No subscription record for this tenant.</p>
          )}
        </TabsContent>

        <TabsContent value="health">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="surface-panel p-4">
              <p className="text-sm text-muted-foreground">Items</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{health.items}</p>
            </div>
            <div className="surface-panel p-4">
              <p className="text-sm text-muted-foreground">Entities</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{health.entities}</p>
            </div>
            <div className="surface-panel p-4">
              <p className="text-sm text-muted-foreground">Purchase orders</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{health.purchase_orders}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity">
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
              {audit.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No audited actions for this tenant yet.
                  </td>
                </tr>
              ) : (
                audit.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {formatWhen(row.created_at)}
                    </td>
                    <td>{row.operator_email}</td>
                    <td>{row.action}</td>
                    <td>{row.target_type}</td>
                  </tr>
                ))
              )}
            </tbody>
          </ConsoleDataTable>
        </TabsContent>
      </Tabs>
    </div>
  );
}
