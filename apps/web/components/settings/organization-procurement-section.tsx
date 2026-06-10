"use client";

import type { UseFormReturn } from "react-hook-form";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { OrganizationSettingsFormValues } from "@/lib/organization/types";

type Props = {
  form: UseFormReturn<OrganizationSettingsFormValues>;
  disabled?: boolean;
};

export function OrganizationProcurementSection({ form, disabled }: Props) {
  const { watch, setValue } = form;
  const allowEditIssued = watch("allow_edit_issued_purchase_orders");
  const purchasePricesTaxInclusive = watch("purchase_prices_tax_inclusive");

  return (
    <OrgSettingsSection
      title="Procurement"
      description="Purchase order editing policies for this workspace."
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <Label htmlFor="allow_edit_issued_purchase_orders" className="text-sm font-medium">
              Allow editing issued purchase orders
            </Label>
            <p className="text-xs text-muted-foreground">
              When enabled, users with purchase order edit permission can change issued orders that
              have not yet been received.
            </p>
          </div>
          <Switch
            id="allow_edit_issued_purchase_orders"
            checked={allowEditIssued}
            disabled={disabled}
            onCheckedChange={(checked) =>
              setValue("allow_edit_issued_purchase_orders", checked, { shouldDirty: true })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <Label htmlFor="purchase_prices_tax_inclusive" className="text-sm font-medium">
              Purchase prices include tax
            </Label>
            <p className="text-xs text-muted-foreground">
              Default for new purchase orders. Each PO can override this on the line table.
            </p>
          </div>
          <Switch
            id="purchase_prices_tax_inclusive"
            checked={purchasePricesTaxInclusive}
            disabled={disabled}
            onCheckedChange={(checked) =>
              setValue("purchase_prices_tax_inclusive", checked, { shouldDirty: true })
            }
          />
        </div>
      </div>
    </OrgSettingsSection>
  );
}
