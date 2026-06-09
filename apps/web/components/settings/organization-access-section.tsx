"use client";

import type { UseFormReturn } from "react-hook-form";
import { GrantDelegateModalSection } from "@/components/settings/grant-delegate-modal";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { PurchaseOrderEditDelegateSection } from "@/components/settings/purchase-order-edit-delegate-section";
import { ProductFieldAccessMatrix } from "@/components/settings/product-field-access-matrix";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrganizationSettingsAccess } from "@/lib/organization/access";
import type {
  OrganizationSettingsFormValues,
  OrganizationSettingsSnapshot,
} from "@/lib/organization/types";

type Props = {
  form: UseFormReturn<OrganizationSettingsFormValues>;
  snapshot: OrganizationSettingsSnapshot;
  access: OrganizationSettingsAccess;
  disabled?: boolean;
};

export function OrganizationAccessSection({ form, snapshot, access, disabled }: Props) {
  const formValues = form.watch();

  return (
    <div className="space-y-4">
      <OrgSettingsSection
        title="Search & Field Visibility"
        description="Workspace-wide search and product field access policies."
      >
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Financial fields in header native filters
          </Label>
          <Select
            value={formValues.search_financial_fields_mode}
            disabled={disabled}
            onValueChange={(value) =>
              form.setValue(
                "search_financial_fields_mode",
                value as OrganizationSettingsFormValues["search_financial_fields_mode"],
                { shouldDirty: true }
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="role_default">Role defaults (managers and above)</SelectItem>
              <SelectItem value="enabled">Enabled for all users</SelectItem>
              <SelectItem value="disabled">Disabled for all users</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Controls whether purchase price and selling price tokens appear in the header omnibar
            native filter engine for STAFF and other roles.
          </p>
        </div>
      </OrgSettingsSection>

      <OrgSettingsSection
        title="Settings Access Delegates"
        description="Grant or revoke organization settings edit access for workspace users."
      >
        <GrantDelegateModalSection
          delegates={snapshot.delegates}
          eligibleUsers={snapshot.eligible_delegate_users}
          canGrantDelegates={access.canGrantDelegates}
        />
      </OrgSettingsSection>

      <OrgSettingsSection
        title="Purchase Order Edit Access"
        description="Owners edit purchase orders by default. Delegate create and edit access to other users."
      >
        <PurchaseOrderEditDelegateSection
          delegates={snapshot.po_edit_delegates}
          eligibleUsers={snapshot.po_edit_eligible_delegate_users}
          canGrantDelegates={access.canGrantDelegates}
        />
      </OrgSettingsSection>

      {access.isOwner ? (
        <ProductFieldAccessMatrix
          initialAccess={snapshot.product_fields_access}
          disabled={false}
        />
      ) : null}
    </div>
  );
}
