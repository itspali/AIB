import Link from "next/link";
import { ConsoleOperatorForm } from "@/components/console/console-operator-form";
import { ConsoleDataTable } from "@/components/console/console-data-table";
import { Badge } from "@/components/ui/badge";
import { requireConsoleAccess } from "@/lib/console/require-console";
import { roleAtLeast } from "@/lib/console/roles";
import type { AppConsoleRole } from "@/lib/console/types";

function roleVariant(role: AppConsoleRole): "completed" | "active" | "action_required" {
  switch (role) {
    case "ADMIN":
      return "completed";
    case "OPERATOR":
      return "active";
    default:
      return "action_required";
  }
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

export default async function ConsoleSettingsAdminsPage() {
  const { admin, operator } = await requireConsoleAccess("VIEWER");

  const { data: operators, error } = await admin
    .from("app_console_operators")
    .select("id, email, role, is_active, mfa_enforced, granted_at, notes, revoked_at")
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const canGrant = roleAtLeast(operator.role, "ADMIN");

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <p className="text-sm">
          <Link href="/console/settings" className="text-primary hover:underline">
            ← Settings
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Console operators</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active operators with access to the App Console.
        </p>
      </header>

      {canGrant ? <ConsoleOperatorForm /> : null}

      <ConsoleDataTable>
        <thead>
          <tr>
            <th className="text-left">Email</th>
            <th className="text-left">Role</th>
            <th className="text-left">Status</th>
            <th className="text-left">MFA enforced</th>
            <th className="text-left">Granted</th>
            <th className="text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {(operators ?? []).length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-muted-foreground">
                No operators configured yet.
              </td>
            </tr>
          ) : (
            (operators ?? []).map((row) => (
              <tr key={row.id as string}>
                <td className="font-medium">{row.email as string}</td>
                <td>
                  <Badge variant={roleVariant(row.role as AppConsoleRole)}>{row.role as string}</Badge>
                </td>
                <td>
                  <Badge variant={row.is_active ? "completed" : "administrative"}>
                    {row.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td>{row.mfa_enforced ? "Yes" : "No"}</td>
                <td className="whitespace-nowrap text-muted-foreground">
                  {formatWhen(row.granted_at as string)}
                </td>
                <td className="text-sm text-muted-foreground">{(row.notes as string | null) ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </ConsoleDataTable>
    </div>
  );
}
