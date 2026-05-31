"use client";

import type { UseFormReturn } from "react-hook-form";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CountryCode } from "@/lib/organization/country-options";
import { COUNTRY_OPTIONS, countryLabel } from "@/lib/organization/country-options";
import { CURRENCY_OPTIONS, currencyLabel } from "@/lib/organization/currency-options";
import { FISCAL_MONTH_OPTIONS } from "@/lib/organization/currency-options";
import type { OrganizationSettingsFormValues } from "@/lib/organization/types";

type Props = {
  form: UseFormReturn<OrganizationSettingsFormValues>;
  baseCurrencyLocked?: boolean;
  disabled?: boolean;
};

export function OrganizationBillingFiscalSection({
  form,
  baseCurrencyLocked,
  disabled,
}: Props) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  return (
    <OrgSettingsSection
      title="Billing & Fiscal"
      description="Corporate billing address and fiscal calendar configuration."
    >
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Billing address</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label htmlFor="billing_address_line1" className="text-sm font-medium text-muted-foreground">
                Address line 1
              </Label>
              <Input id="billing_address_line1" disabled={disabled} {...register("billing_address_line1")} />
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label htmlFor="billing_address_line2" className="text-sm font-medium text-muted-foreground">
                Address line 2
              </Label>
              <Input id="billing_address_line2" disabled={disabled} {...register("billing_address_line2")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_city" className="text-sm font-medium text-muted-foreground">
                City
              </Label>
              <Input id="billing_city" disabled={disabled} {...register("billing_city")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_state" className="text-sm font-medium text-muted-foreground">
                State / province
              </Label>
              <Input id="billing_state" disabled={disabled} {...register("billing_state")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_zip_postal" className="text-sm font-medium text-muted-foreground">
                Postal code
              </Label>
              <Input id="billing_zip_postal" disabled={disabled} {...register("billing_zip_postal")} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Country</Label>
              <Select
                value={watch("billing_country_code") || "none"}
                disabled={disabled}
                onValueChange={(value) =>
                  setValue(
                    "billing_country_code",
                    value === "none" ? "" : (value as CountryCode),
                    { shouldDirty: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {COUNTRY_OPTIONS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {countryLabel(code)} ({code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Fiscal engine rules</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Base currency</Label>
              <Select
                value={watch("base_currency")}
                disabled={disabled || baseCurrencyLocked}
                onValueChange={(value) =>
                  setValue("base_currency", value as OrganizationSettingsFormValues["base_currency"], {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {currencyLabel(code)} ({code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {baseCurrencyLocked && (
                <p className="text-xs text-muted-foreground">
                  Locked because inventory activity already exists in this workspace.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Fiscal year start month
              </Label>
              <Select
                value={watch("fiscal_year_start_month")}
                disabled={disabled}
                onValueChange={(value) =>
                  setValue("fiscal_year_start_month", value, { shouldDirty: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FISCAL_MONTH_OPTIONS.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fiscal_year_start_month && (
                <p className="text-xs text-destructive">{errors.fiscal_year_start_month.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </OrgSettingsSection>
  );
}
