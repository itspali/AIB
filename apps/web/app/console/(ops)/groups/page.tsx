import { ConsoleDataTable } from "@/components/console/console-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireConsoleAccess } from "@/lib/console/require-console";
import { fetchGroupDirectory } from "@/lib/console/queries/group-directory";
import type { GroupAccountStatus } from "@/lib/console/types";

type SearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function groupStatusVariant(status: GroupAccountStatus): "completed" | "action_required" | "administrative" {
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

export default async function ConsoleGroupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const search = param(sp, "search");
  const status = param(sp, "status") as GroupAccountStatus | undefined;
  const page = Math.max(1, Number(param(sp, "page") ?? "1") || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const { admin } = await requireConsoleAccess("VIEWER");
  const { rows, total } = await fetchGroupDirectory(admin, { search, status, limit, offset });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tenant groups</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enterprise groups and their member workspace counts.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[16rem] flex-1 space-y-1">
          <label htmlFor="group_search" className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            id="group_search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Name, GRP code, or email"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="group_status" className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            id="group_status"
            name="status"
            defaultValue={status ?? ""}
            className="flex h-10 min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <th className="text-left">Primary email</th>
            <th className="text-right">Members</th>
            <th className="text-left">Active</th>
            <th className="text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-muted-foreground">
                No groups match your filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="font-mono text-xs">{row.group_code}</td>
                <td className="font-medium">{row.name}</td>
                <td>
                  <Badge variant={groupStatusVariant(row.status)}>{row.status}</Badge>
                </td>
                <td>{row.primary_email}</td>
                <td className="text-right tabular-nums">{row.member_count}</td>
                <td>
                  <Badge variant={row.is_active ? "completed" : "administrative"}>
                    {row.is_active ? "Yes" : "No"}
                  </Badge>
                </td>
                <td className="whitespace-nowrap text-muted-foreground">{formatDate(row.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </ConsoleDataTable>

      <p className="text-sm text-muted-foreground">
        {total} group{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
      </p>
    </div>
  );
}
