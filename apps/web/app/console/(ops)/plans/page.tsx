import { ConsolePlanForm } from "@/components/console/console-plan-form";
import { ConsoleDataTable } from "@/components/console/console-data-table";
import { Badge } from "@/components/ui/badge";
import { requireConsoleAccess } from "@/lib/console/require-console";
import { fetchSubscriptionPlans } from "@/lib/console/queries/subscription-plans";
import { roleAtLeast } from "@/lib/console/roles";

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export default async function ConsolePlansPage() {
  const { admin, operator } = await requireConsoleAccess("VIEWER");
  const { rows } = await fetchSubscriptionPlans(admin);
  const canCreate = roleAtLeast(operator.role, "ADMIN");

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Subscription plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catalog of billing plans available to tenants.
        </p>
      </header>

      {canCreate ? <ConsolePlanForm /> : null}

      <ConsoleDataTable>
        <thead>
          <tr>
            <th className="text-left">Code</th>
            <th className="text-left">Name</th>
            <th className="text-left">Price</th>
            <th className="text-left">Interval</th>
            <th className="text-right">Trial days</th>
            <th className="text-left">Visibility</th>
            <th className="text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-muted-foreground">
                No subscription plans configured yet.
              </td>
            </tr>
          ) : (
            rows.map((plan) => (
              <tr key={plan.id}>
                <td className="font-mono text-xs">{plan.code}</td>
                <td>
                  <div className="font-medium">{plan.name}</div>
                  {plan.description ? (
                    <div className="text-xs text-muted-foreground">{plan.description}</div>
                  ) : null}
                </td>
                <td>{formatMoney(plan.price_amount, plan.price_currency)}</td>
                <td>{plan.billing_interval}</td>
                <td className="text-right tabular-nums">{plan.trial_days}</td>
                <td>
                  <Badge variant={plan.is_public ? "active" : "locked"}>
                    {plan.is_public ? "Public" : "Private"}
                  </Badge>
                </td>
                <td>
                  <Badge variant={plan.is_active ? "completed" : "administrative"}>
                    {plan.is_active ? "Active" : "Archived"}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </ConsoleDataTable>
    </div>
  );
}
