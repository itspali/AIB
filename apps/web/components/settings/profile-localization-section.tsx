"use client";

import type { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTimezoneOptions } from "@/lib/settings/timezone-options";
import type { ProfileSettingsFormValues } from "@/lib/settings/types";

type Props = {
  form: UseFormReturn<ProfileSettingsFormValues>;
  disabled?: boolean;
};

const timezoneOptions = getTimezoneOptions();

export function ProfileLocalizationSection({ form, disabled }: Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = form;

  const timezone = watch("timezone");
  const uiDensity = watch("ui_density");

  return (
    <section className="surface-panel space-y-4">
      <h2 className="text-xl font-semibold">Localization &amp; Regional Preferences</h2>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Home timezone</Label>
        <Select
          value={timezone}
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
        {errors.timezone && <p className="text-xs text-destructive">{errors.timezone.message}</p>}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Interface density</Label>
        <Select
          value={uiDensity}
          disabled={disabled}
          onValueChange={(value) =>
            setValue("ui_density", value as ProfileSettingsFormValues["ui_density"], {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STANDARD">Standard — inventory and general operations</SelectItem>
            <SelectItem value="DENSE">Dense — accounting and ledger operations</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
