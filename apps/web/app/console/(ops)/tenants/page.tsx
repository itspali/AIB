import Link from "next/link";
import { ConsoleDataTable } from "@/components/console/console-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireConsoleAccess } from "@/lib/console/require-console";
import { fetchTenantDirectory } from "@/lib/console/queries/tenant-directory";
import type { TenantAccountStatus } from "@/lib/console/types";

type SearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

export default async function ConsoleTenantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const search = param(sp, "search");
  const status = param(sp, "status") as TenantAccountStatus | undefined;
  const page = Math.max(1, Number(param(sp, "page") ?? "1") || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const { admin } = await requireConsoleAccess("VIEWER");
  const { rows, total } = await fetchTenantDirectory(admin, { search, status, limit, offset });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search workspaces by name, organization code, or owner email.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[16rem] flex-1 space-y-1">
          <label htmlFor="tenant_search" className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            id="tenant_search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Name, ORG code, or email"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="tenant_status" className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            id="tenant_status"
            name="status"
            defaultValue={status ?? ""}
            className="flex h-10 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="PAST_DUE">Past due</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
        <Button type="submit">Apply</Button>
      </form>

      <ConsoleDataTable>
        <thead>
          <tr>
            <th className="text-left">Code</th>
            <th className="text-left">Name</th>
            <th className="text-left">Status</th>
            <th className="text-left">Onboarding</th>
            <th className="text-left">Owner</th>
            <th className="text-right">Users</th>
            <th className="text-right">Locations</th>
            <th className="text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-muted-foreground">
                No tenants match your filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link
                    href={`/console/tenants/${row.id}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {row.organization_code}
                  </Link>
                </td>
                <td>
                  <Link href={`/console/tenants/${row.id}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                </td>
                <td>
                  <Badge variant={tenantStatusVariant(row.status)}>{row.status}</Badge>
                </td>
                <td className="text-xs text-muted-foreground">{row.onboarding_status}</td>
                <td className="text-sm">{row.owner_email ?? "—"}</td>
                <td className="text-right tabular-nums">{row.user_count}</td>
                <td className="text-right tabular-nums">{row.location_count}</td>
                <td className="whitespace-nowrap text-muted-foreground">{formatDate(row.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </ConsoleDataTable>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} tenant{total === 1 ? "" : "s"}
          {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={{
                  pathname: "/console/tenants",
                  query: {
                    ...(search ? { search } : {}),
                    ...(status ? { status } : {}),
                    page: String(page - 1),
                  },
                }}
              >
                Previous
              </Link>
            </Button>
          ) : null}
          {page < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={{
                  pathname: "/console/tenants",
                  query: {
                    ...(search ? { search } : {}),
                    ...(status ? { status } : {}),
                    page: String(page + 1),
                  },
                }}
              >
                Next
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
