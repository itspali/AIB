import Link from "next/link";
import { ConsoleDataTable } from "@/components/console/console-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireConsoleAccess } from "@/lib/console/require-console";
import { fetchAuditLog } from "@/lib/console/queries/audit-log";
import type { AppConsoleAction } from "@/lib/console/types";

type SearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

const AUDIT_ACTIONS: AppConsoleAction[] = [
  "TENANT_SUSPEND",
  "TENANT_REACTIVATE",
  "INTERNAL_ADMIN_GRANT",
  "INTERNAL_ADMIN_REVOKE",
  "PLATFORM_CONFIG_UPDATE",
  "PLAN_CREATE",
  "PLAN_UPDATE",
  "PLAN_ARCHIVE",
  "SIGNUP_RETRY_PROVISION",
  "IMPERSONATION_START",
  "IMPERSONATION_END",
];

export default async function ConsoleAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const action = param(sp, "action") as AppConsoleAction | undefined;
  const tenantId = param(sp, "tenantId");
  const page = Math.max(1, Number(param(sp, "page") ?? "1") || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const { admin } = await requireConsoleAccess("VIEWER");
  const { rows, total } = await fetchAuditLog(admin, {
    action,
    tenantId,
    limit,
    offset,
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable record of operator actions across the platform.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1">
          <label htmlFor="audit_action" className="text-xs font-medium text-muted-foreground">
            Action
          </label>
          <select
            id="audit_action"
            name="action"
            defaultValue={action ?? ""}
            className="flex h-10 min-w-[12rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1 space-y-1">
          <label htmlFor="audit_tenant" className="text-xs font-medium text-muted-foreground">
            Tenant ID
          </label>
          <Input id="audit_tenant" name="tenantId" defaultValue={tenantId ?? ""} placeholder="UUID" />
        </div>
        <Button type="submit">Apply</Button>
      </form>

      <ConsoleDataTable>
        <thead>
          <tr>
            <th className="text-left">When</th>
            <th className="text-left">Operator</th>
            <th className="text-left">Action</th>
            <th className="text-left">Target</th>
            <th className="text-left">Tenant</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                No audit events match your filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap text-muted-foreground">{formatWhen(row.created_at)}</td>
                <td>{row.operator_email}</td>
                <td className="font-mono text-xs">{row.action}</td>
                <td>
                  {row.target_type}
                  {row.target_id ? (
                    <div className="text-xs text-muted-foreground">{row.target_id}</div>
                  ) : null}
                </td>
                <td>
                  {row.tenant_id ? (
                    <Link
                      href={`/console/tenants/${row.tenant_id}`}
                      className="text-primary hover:underline"
                    >
                      View tenant
                    </Link>
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
        {total} event{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
      </p>
    </div>
  );
}
