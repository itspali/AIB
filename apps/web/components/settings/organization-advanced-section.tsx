"use client";

import type { UseFormReturn } from "react-hook-form";
import { DocumentSequenceReadout } from "@/components/settings/document-sequence-readout";
import { NamingSequenceEditor } from "@/components/settings/naming-sequence-editor";
import { OrganizationLogoUploader } from "@/components/settings/organization-logo-uploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { creditControlLabel, CREDIT_CONTROL_OPTIONS } from "@/lib/organization/credit-control-options";
import { VALUATION_METHOD_OPTIONS } from "@/lib/organization/naming-options";
import type {
  DocumentSequenceRow,
  OrganizationSettingsFormValues,
  TenantLocationOption,
} from "@/lib/organization/types";

type SectionIds = {
  brand: string;
  location: string;
  naming: string;
  accounting: string;
};

type Props = {
  form: UseFormReturn<OrganizationSettingsFormValues>;
  tenantId: string;
  sectionIds: SectionIds;
  logoPreviewUrl?: string | null;
  locations: TenantLocationOption[];
  documentSequences: DocumentSequenceRow[];
  disabled?: boolean;
};

function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function OrganizationAdvancedSection({
  form,
  tenantId,
  sectionIds,
  logoPreviewUrl,
  locations,
  documentSequences,
  disabled,
}: Props) {
  const { register, watch, setValue } = form;
  const namingSequences = watch("naming_sequences");

  return (
    <div className="space-y-4">
      <section id={sectionIds.brand} className="surface-panel scroll-mt-40 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Brand &amp; Web Presence
        </h2>
        <OrganizationLogoUploader
          tenantId={tenantId}
          value={watch("logo_url")}
          previewUrl={logoPreviewUrl}
          disabled={disabled}
          onUploaded={(path) => setValue("logo_url", path, { shouldDirty: true })}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="secondary_phone" className="text-sm font-medium text-muted-foreground">
              Secondary phone
            </Label>
            <Input id="secondary_phone" disabled={disabled} {...register("secondary_phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website_url" className="text-sm font-medium text-muted-foreground">
              Corporate website
            </Label>
            <Input id="website_url" disabled={disabled} {...register("website_url")} />
          </div>
        </div>
      </section>

      <section id={sectionIds.location} className="surface-panel scroll-mt-40 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Location Governance
        </h2>
        <SwitchRow
          label="Multi-location enabled"
          description="Allow operational routing across multiple warehouse and branch locations."
          checked={watch("multi_location_enabled")}
          disabled={disabled}
          onCheckedChange={(checked) =>
            setValue("multi_location_enabled", checked, { shouldDirty: true })
          }
        />
        <SwitchRow
          label="Regional HQs enabled"
          description="Enable regional headquarters topology controls."
          checked={watch("regional_hqs_enabled")}
          disabled={disabled}
          onCheckedChange={(checked) =>
            setValue("regional_hqs_enabled", checked, { shouldDirty: true })
          }
        />
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Central HQ location</Label>
          <Select
            value={watch("central_hq_location_id") ?? "none"}
            disabled={disabled}
            onValueChange={(value) =>
              setValue("central_hq_location_id", value === "none" ? null : value, {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not assigned</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name} ({location.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SwitchRow
          label="Restrict cross-warehouse stock transfers"
          description="When enabled, inter-location stock movement requires explicit governance approval."
          checked={watch("restrict_cross_warehouse_transfers")}
          disabled={disabled}
          onCheckedChange={(checked) =>
            setValue("restrict_cross_warehouse_transfers", checked, { shouldDirty: true })
          }
        />
      </section>

      <section id={sectionIds.naming} className="surface-panel scroll-mt-40 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Document Naming Sequences
        </h2>
        <NamingSequenceEditor
          values={namingSequences}
          disabled={disabled}
          onChange={(key, field, value) =>
            setValue(
              "naming_sequences",
              {
                ...namingSequences,
                [key]: {
                  ...(namingSequences[key] ?? { prefix: "", digits: "5" }),
                  [field]: value,
                },
              },
              { shouldDirty: true }
            )
          }
        />
        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-medium">Live sequence counters</h3>
          <DocumentSequenceReadout rows={documentSequences} />
        </div>
      </section>

      <section id={sectionIds.accounting} className="surface-panel scroll-mt-40 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Accounting &amp; Workspace Controls
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Inventory valuation method
            </Label>
            <Select
              value={watch("inventory_valuation_method")}
              disabled={disabled}
              onValueChange={(value) =>
                setValue("inventory_valuation_method", value, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALUATION_METHOD_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Runtime valuation engine executes MWAC on inventory ledger postings.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Credit control enforcement
            </Label>
            <Select
              value={watch("credit_control_enforcement")}
              disabled={disabled}
              onValueChange={(value) =>
                setValue(
                  "credit_control_enforcement",
                  value as OrganizationSettingsFormValues["credit_control_enforcement"],
                  { shouldDirty: true }
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_CONTROL_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {creditControlLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SwitchRow
          label="Allow negative inventory"
          description="Permit stock balances to fall below zero at posting time."
          checked={watch("allow_negative_inventory")}
          disabled={disabled}
          onCheckedChange={(checked) =>
            setValue("allow_negative_inventory", checked, { shouldDirty: true })
          }
        />
        <SwitchRow
          label="Multi-currency enabled"
          description="Enable foreign currency documents and exchange rate handling."
          checked={watch("multi_currency_enabled")}
          disabled={disabled}
          onCheckedChange={(checked) =>
            setValue("multi_currency_enabled", checked, { shouldDirty: true })
          }
        />
        <SwitchRow
          label="Allow line-item markdown discounts"
          description="Consolidated sales workspace control (formerly on dashboard)."
          checked={watch("allow_line_item_discounts")}
          disabled={disabled}
          onCheckedChange={(checked) =>
            setValue("allow_line_item_discounts", checked, { shouldDirty: true })
          }
        />
        <div className="space-y-2">
          <Label htmlFor="accounting_period_closing_date" className="text-sm font-medium text-muted-foreground">
            Fiscal period closing lockout
          </Label>
          <Input
            id="accounting_period_closing_date"
            type="date"
            disabled={disabled}
            {...register("accounting_period_closing_date")}
          />
          <p className="text-xs text-muted-foreground">
            Entries on or before this date are blocked by period lockout triggers.
          </p>
        </div>
      </section>
    </div>
  );
}
