"use client";

import { Badge } from "@/components/ui/badge";
import { GrantDelegateModalSection } from "@/components/settings/grant-delegate-modal";
import { creditControlLabel } from "@/lib/organization/credit-control-options";
import { formatDate } from "@/lib/dashboard/format";
import type { OrganizationSettingsAccess } from "@/lib/organization/access";
import type { OrganizationSettingsFormValues, OrganizationSettingsSnapshot } from "@/lib/organization/types";

type Props = {
  snapshot: OrganizationSettingsSnapshot;
  access: OrganizationSettingsAccess;
  formValues: OrganizationSettingsFormValues;
  showAdvanced: boolean;
};

export function OrganizationGovernanceRail({
  snapshot,
  access,
  formValues,
  showAdvanced,
}: Props) {
  return (
    <aside className="space-y-4">
      <section className="surface-panel space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace Lifecycle
        </h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant={snapshot.is_active ? "completed" : "locked"}>
            {snapshot.is_active ? "ACTIVE" : "SUSPENDED"}
          </Badge>
          <Badge variant="active">{snapshot.status.replace(/_/g, " ")}</Badge>
          <Badge variant="locked">
            {snapshot.onboarding_status.replace(/_/g, " ")}
          </Badge>
        </div>
        {snapshot.created_by_name && (
          <p className="text-sm text-muted-foreground">
            Created by <span className="text-foreground">{snapshot.created_by_name}</span>
          </p>
        )}
      </section>

      <section className="surface-panel space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Policy Summary
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Base currency</dt>
            <dd className="font-mono">{formValues.base_currency}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Valuation</dt>
            <dd>{formValues.inventory_valuation_method}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Credit control</dt>
            <dd>{creditControlLabel(formValues.credit_control_enforcement)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Line discounts</dt>
            <dd>{formValues.allow_line_item_discounts ? "Allowed" : "Blocked"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Stock transfers</dt>
            <dd>
              {formValues.restrict_cross_warehouse_transfers ? "Restricted" : "Consensual"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="surface-panel space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Settings Access Delegates
        </h2>
        <GrantDelegateModalSection
          delegates={snapshot.delegates}
          eligibleUsers={snapshot.eligible_delegate_users}
          canGrantDelegates={access.canGrantDelegates}
          showAdvanced={showAdvanced}
        />
      </section>

      <section className="text-xs text-muted-foreground">
        <p>Created {formatDate(snapshot.created_at)}</p>
        <p>Updated {formatDate(snapshot.updated_at)}</p>
      </section>
    </aside>
  );
}
