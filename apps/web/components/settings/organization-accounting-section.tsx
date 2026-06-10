"use client";

import type { UseFormReturn } from "react-hook-form";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
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
import type { OrganizationSettingsFormValues } from "@/lib/organization/types";
import { SCAN_IDENTIFIER_POLICIES, scanIdentifierPolicyLabel } from "@/lib/products/catalog-item-settings";

type Props = {
  form: UseFormReturn<OrganizationSettingsFormValues>;
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

export function OrganizationAccountingSection({ form, disabled }: Props) {
  const { register, watch, setValue } = form;

  return (
    <OrgSettingsSection
      title="Accounting & Workspace Controls"
      description="Default inventory calculation rule and posting guardrails."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Default inventory calculation rule
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
            Default calculation rule for stock-holding and storefront locations without an explicit
            override. MWAC runs when the resolved rule is MWAC; FIFO postings fail until cost
            layers are implemented.
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
      <SwitchRow
        label="Allow transaction trade discounts"
        description="Header-level trade discount on purchase orders (reduces taxable value before tax)."
        checked={watch("allow_transaction_discounts")}
        disabled={disabled}
        onCheckedChange={(checked) =>
          setValue("allow_transaction_discounts", checked, { shouldDirty: true })
        }
      />

      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">Item catalog</p>
          <p className="text-xs text-muted-foreground">
            How scanning resolves products and whether new item SKUs are auto-generated.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Scan lookup uses</Label>
            <Select
              value={watch("scan_identifier_policy")}
              disabled={disabled}
              onValueChange={(value) =>
                setValue(
                  "scan_identifier_policy",
                  value as OrganizationSettingsFormValues["scan_identifier_policy"],
                  { shouldDirty: true }
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCAN_IDENTIFIER_POLICIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {scanIdentifierPolicyLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku_auto_pattern" className="text-sm font-medium text-muted-foreground">
              Auto SKU pattern
            </Label>
            <Input
              id="sku_auto_pattern"
              disabled={disabled || !watch("sku_auto_generation_enabled")}
              placeholder="{PREFIX}-{SEQ:6}"
              {...register("sku_auto_pattern")}
            />
            <p className="text-xs text-muted-foreground">
              Tokens: {"{PREFIX}"}, {"{SEQ:6}"} (width optional).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku_auto_prefix" className="text-sm font-medium text-muted-foreground">
              Auto SKU prefix
            </Label>
            <Input
              id="sku_auto_prefix"
              disabled={disabled || !watch("sku_auto_generation_enabled")}
              {...register("sku_auto_prefix")}
            />
          </div>
        </div>
        <SwitchRow
          label="Auto-generate SKU on new items"
          description="When enabled, blank SKU on create is filled from the pattern above on save."
          checked={watch("sku_auto_generation_enabled")}
          disabled={disabled}
          onCheckedChange={(checked) =>
            setValue("sku_auto_generation_enabled", checked, { shouldDirty: true })
          }
        />
      </div>
    </OrgSettingsSection>
  );
}
