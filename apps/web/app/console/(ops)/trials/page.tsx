import Link from "next/link";
import { ConsoleDataTable } from "@/components/console/console-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireConsoleAccess } from "@/lib/console/require-console";
import { fetchTrialQueue, type TrialQueueView } from "@/lib/console/queries/trial-queue";

type SearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

export default async function ConsoleTrialsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const view = (param(sp, "view") as TrialQueueView | undefined) ?? "expiring_7d";
  const page = Math.max(1, Number(param(sp, "page") ?? "1") || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const { admin } = await requireConsoleAccess("VIEWER");
  const { rows, total } = await fetchTrialQueue(admin, { view, limit, offset });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Trial queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trialing subscriptions sorted by trial end date.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["expiring_7d", "Expiring in 7 days"],
            ["active", "Active trials"],
            ["expired", "Expired trials"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            asChild
            variant={view === value ? "default" : "outline"}
            size="sm"
          >
            <Link href={`/console/trials?view=${value}`}>{label}</Link>
          </Button>
        ))}
      </div>

      <ConsoleDataTable>
        <thead>
          <tr>
            <th className="text-left">Tenant</th>
            <th className="text-left">Plan</th>
            <th className="text-left">Status</th>
            <th className="text-left">Trial ends</th>
            <th className="text-right">Days left</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                No trials in this queue.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.subscription_id}>
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
                  <Badge variant="action_required">{row.subscription_status}</Badge>
                </td>
                <td className="whitespace-nowrap">{formatDate(row.trial_ends_at)}</td>
                <td className="text-right tabular-nums">
                  {row.days_remaining != null ? (
                    <span
                      className={
                        row.days_remaining <= 3 ? "font-medium text-amber-700 dark:text-amber-300" : ""
                      }
                    >
                      {row.days_remaining}d
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </ConsoleDataTable>

      <p className="text-sm text-muted-foreground">
        {total} trial{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
      </p>
    </div>
  );
}
