import Link from "next/link";
import { ConsoleDataTable } from "@/components/console/console-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireConsoleAccess } from "@/lib/console/require-console";
import { fetchTenantSubscriptions } from "@/lib/console/queries/tenant-subscriptions";
import type { TenantSubscriptionStatus } from "@/lib/console/types";

type SearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function subscriptionStatusVariant(
  status: TenantSubscriptionStatus
): "completed" | "action_required" | "administrative" | "active" {
  switch (status) {
    case "ACTIVE":
      return "completed";
    case "TRIALING":
      return "action_required";
    case "PAST_DUE":
      return "action_required";
    default:
      return "administrative";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export default async function ConsoleSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status = param(sp, "status") as TenantSubscriptionStatus | undefined;
  const search = param(sp, "search");
  const page = Math.max(1, Number(param(sp, "page") ?? "1") || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const { admin } = await requireConsoleAccess("VIEWER");
  const { rows, total } = await fetchTenantSubscriptions(admin, {
    status,
    search,
    limit,
    offset,
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tenant subscription records joined with plan and workspace details.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[14rem] flex-1 space-y-1">
          <label htmlFor="sub_search" className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            id="sub_search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Tenant, ORG code, or plan"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="sub_status" className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            id="sub_status"
            name="status"
            defaultValue={status ?? ""}
            className="flex h-10 min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="TRIALING">Trialing</option>
            <option value="ACTIVE">Active</option>
            <option value="PAST_DUE">Past due</option>
            <option value="CANCELED">Canceled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
        <Button type="submit">Apply</Button>
      </form>

      <ConsoleDataTable>
        <thead>
          <tr>
            <th className="text-left">Tenant</th>
            <th className="text-left">Plan</th>
            <th className="text-left">Status</th>
            <th className="text-left">Price</th>
            <th className="text-left">Trial ends</th>
            <th className="text-left">Period end</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-muted-foreground">
                No subscriptions match your filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link
                    href={`/console/tenants/${row.tenant_id}`}
                    className="font-medium hover:underline"
                  >
                    {row.tenant_name}
                  </Link>
                  <div className="font-mono text-xs text-muted-foreground">
                    {row.organization_code}
                  </div>
                </td>
                <td>
                  {row.plan_name}
                  <div className="text-xs text-muted-foreground">{row.plan_code}</div>
                </td>
                <td>
                  <Badge variant={subscriptionStatusVariant(row.subscription_status)}>
                    {row.subscription_status}
                  </Badge>
                </td>
                <td>{formatMoney(row.price_amount, row.price_currency)}</td>
                <td className="whitespace-nowrap">{formatDate(row.trial_ends_at)}</td>
                <td className="whitespace-nowrap">{formatDate(row.current_period_end)}</td>
              </tr>
            ))
          )}
        </tbody>
      </ConsoleDataTable>

      <p className="text-sm text-muted-foreground">
        {total} subscription{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
      </p>
    </div>
  );
}
