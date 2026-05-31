"use client";

import type { UseFormReturn } from "react-hook-form";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
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
import { LOCALE_OPTIONS } from "@/lib/organization/locale-options";
import { getTimezoneOptions } from "@/lib/settings/timezone-options";
import type { OrganizationSettingsFormValues } from "@/lib/organization/types";

type Props = {
  form: UseFormReturn<OrganizationSettingsFormValues>;
  disabled?: boolean;
};

const timezoneOptions = getTimezoneOptions();

export function OrganizationLocalizationSection({ form, disabled }: Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = form;

  return (
    <OrgSettingsSection
      title="Regional & Localization"
      description="Operating jurisdiction, workspace timezone, and formatting locale."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Operating country</Label>
          <Select
            value={watch("country_code") || "none"}
            disabled={disabled}
            onValueChange={(value) =>
              setValue("country_code", value === "none" ? "" : (value as CountryCode), {
                shouldDirty: true,
              })
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
          <p className="text-xs text-muted-foreground">
            Drives chart-of-accounts and tax template defaults for this workspace.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Workspace timezone</Label>
          <Select
            value={watch("timezone")}
            disabled={disabled}
            onValueChange={(value) => setValue("timezone", value, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {timezoneOptions.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.timezone && (
            <p className="text-xs text-destructive">{errors.timezone.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Default for document timestamps, period cutoffs, and reporting.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Formatting locale</Label>
          <Select
            value={watch("locale")}
            disabled={disabled}
            onValueChange={(value) => setValue("locale", value, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select locale" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {LOCALE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.locale && <p className="text-xs text-destructive">{errors.locale.message}</p>}
          <p className="text-xs text-muted-foreground">
            Number, date, and currency display formatting.
          </p>
        </div>
      </div>
    </OrgSettingsSection>
  );
}
