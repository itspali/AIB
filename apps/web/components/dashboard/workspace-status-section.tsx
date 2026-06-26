import Link from "next/link";
import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import { fetchWorkspaceControls } from "@/lib/dashboard/queries";
import { createClient } from "@/lib/supabase/server";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { formatDate } from "@/lib/dashboard/format";

export async function WorkspaceStatusSection() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);
  if (!tenantId) return null;

  const controls = await fetchWorkspaceControls(supabase, tenantId);
  const hasFiscalLock = Boolean(controls.accountingPeriodClosingDate);

  if (controls.allowLineItemDiscounts && !hasFiscalLock) return null;

  return (
    <section
      aria-label="Workspace policy status"
      className="surface-panel mb-8 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
    >
      <div className="space-y-1 text-sm">
        <p className="font-medium text-foreground">Workspace policy</p>
        <ul className="space-y-0.5 text-muted-foreground">
          <li>
            Line-item discounts:{" "}
            <span className="text-foreground">
              {controls.allowLineItemDiscounts ? "Allowed" : "Blocked"}
            </span>
          </li>
          {hasFiscalLock ? (
            <li>
              Fiscal period closed through:{" "}
              <span className="text-foreground">
                {formatDate(controls.accountingPeriodClosingDate!)}
              </span>
            </li>
          ) : null}
        </ul>
      </div>
      <Link
        href={SETTINGS_ROUTES.company}
        className="text-sm font-medium text-primary hover:underline"
      >
        Manage in Company settings
      </Link>
    </section>
  );
}
