"use client";

import type { ChangeEvent } from "react";
import { EntityCustomFieldsSection } from "@/components/entities/entity-custom-fields-section";
import { EntityFormSubsection } from "@/components/entities/form/entity-form-subsection";
import { EntityLogoUploader } from "@/components/entities/entity-logo-uploader";
import { DrawerFormField, DrawerFormGrid } from "@/components/layout/drawer-form-grid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";
import type { EntityFormValues } from "@/lib/entities/types";
import {
  CURRENCY_OPTIONS,
  currencyLabel,
  type OrganizationCurrency,
} from "@/lib/organization/currency-options";

type Props = {
  tenantId: string;
  form: EntityFormValues;
  logoPreviewUrl: string | null;
  customFieldBucket: "customer_custom_fields" | "supplier_custom_fields";
  effectiveFieldDefinitions: EntityCustomFieldDefinition[];
  fieldsDisabled: boolean;
  onFormChange: (updater: (current: EntityFormValues) => EntityFormValues) => void;
  onLogoUploaded: (storagePath: string) => void;
};

export function EntityAdvancedFields({
  tenantId,
  form,
  logoPreviewUrl,
  customFieldBucket,
  effectiveFieldDefinitions,
  fieldsDisabled,
  onFormChange,
  onLogoUploaded,
}: Props) {
  return (
    <>
      <EntityFormSubsection title="Company profile">
        <DrawerFormGrid maxColumns={2}>
          <DrawerFormField>
            <Label htmlFor="entity-legal-name">Legal name</Label>
            <Input
              id="entity-legal-name"
              value={form.legal_name}
              disabled={fieldsDisabled}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, legal_name: event.target.value }))
              }
            />
          </DrawerFormField>
          <DrawerFormField>
            <Label htmlFor="entity-code">Code</Label>
            <Input
              id="entity-code"
              value={form.code}
              disabled={fieldsDisabled}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, code: event.target.value }))
              }
            />
          </DrawerFormField>
          <DrawerFormField>
            <Label htmlFor="entity-company-email">Company email</Label>
            <Input
              id="entity-company-email"
              type="email"
              value={form.company_email}
              disabled={fieldsDisabled}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, company_email: event.target.value }))
              }
            />
          </DrawerFormField>
          <DrawerFormField>
            <Label htmlFor="entity-company-phone">Company phone</Label>
            <Input
              id="entity-company-phone"
              value={form.company_phone}
              disabled={fieldsDisabled}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, company_phone: event.target.value }))
              }
            />
          </DrawerFormField>
          <DrawerFormField span="full">
            <Label htmlFor="entity-website">Website</Label>
            <Input
              id="entity-website"
              value={form.website_url}
              disabled={fieldsDisabled}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, website_url: event.target.value }))
              }
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </EntityFormSubsection>

      <EntityFormSubsection title="Trading currency">
        <DrawerFormGrid maxColumns={2}>
          <DrawerFormField span="full">
            <Label htmlFor="entity-trading-currency">Trading currency</Label>
            <Select
              value={form.base_currency_override || "__workspace_default__"}
              disabled={fieldsDisabled}
              onValueChange={(value) =>
                onFormChange((current) => ({
                  ...current,
                  base_currency_override:
                    value === "__workspace_default__" ? "" : (value as OrganizationCurrency),
                }))
              }
            >
              <SelectTrigger id="entity-trading-currency" className="w-full">
                <SelectValue placeholder="Workspace default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__workspace_default__">Workspace default</SelectItem>
                {CURRENCY_OPTIONS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {currencyLabel(code)} ({code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used as the default currency on purchase orders for this supplier. Leave unset to use
              the workspace base currency.
            </p>
          </DrawerFormField>
        </DrawerFormGrid>
      </EntityFormSubsection>

      {effectiveFieldDefinitions.length > 0 ? (
        <EntityFormSubsection title="Custom fields">
          <EntityCustomFieldsSection
            definitions={effectiveFieldDefinitions}
            values={form[customFieldBucket]}
            disabled={fieldsDisabled}
            hideIntro
            onChange={(values) =>
              onFormChange((current) => ({ ...current, [customFieldBucket]: values }))
            }
          />
        </EntityFormSubsection>
      ) : null}

      <EntityFormSubsection title="Branding">
        <EntityLogoUploader
          tenantId={tenantId}
          entityId={form.entity_id}
          draftStorageKey={form.draft_storage_key}
          value={form.logo_url}
          previewUrl={logoPreviewUrl}
          disabled={fieldsDisabled}
          onUploaded={onLogoUploaded}
        />
      </EntityFormSubsection>

      <EntityFormSubsection title="Internal notes">
        <DrawerFormGrid maxColumns={2}>
          <DrawerFormField span="full">
            <Label htmlFor="entity-notes">Internal notes</Label>
            <textarea
              id="entity-notes"
              value={form.internal_notes}
              disabled={fieldsDisabled}
              rows={4}
              className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                onFormChange((current) => ({ ...current, internal_notes: event.target.value }))
              }
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </EntityFormSubsection>
    </>
  );
}
