"use client";

import type { UseFormReturn } from "react-hook-form";
import { ThemeSettingsFields } from "@/components/theme/theme-settings-fields";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { OrganizationLogoUploader } from "@/components/settings/organization-logo-uploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrganizationSettingsFormValues } from "@/lib/organization/types";

type Props = {
  form: UseFormReturn<OrganizationSettingsFormValues>;
  tenantId: string;
  logoPreviewUrl?: string | null;
  disabled?: boolean;
};

export function OrganizationBrandSection({
  form,
  tenantId,
  logoPreviewUrl,
  disabled,
}: Props) {
  const { register, watch, setValue } = form;
  const themeSettings = watch([
    "default_theme",
    "primary_hue",
    "accent_hue",
    "allow_location_theme_override",
    "allow_user_theme_override",
  ]);

  return (
    <>
      <OrgSettingsSection
        title="Brand & Web Presence"
        description="Workspace logo and public-facing contact channels."
      >
        <OrganizationLogoUploader
          tenantId={tenantId}
          value={watch("logo_url")}
          previewUrl={logoPreviewUrl}
          disabled={disabled}
          onUploaded={(path) => setValue("logo_url", path, { shouldDirty: true })}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
      </OrgSettingsSection>

      <OrgSettingsSection
        title="Workspace Theme"
        description="Set the default appearance for this account and control whether locations and users can override it."
      >
        <ThemeSettingsFields
          disabled={disabled}
          value={{
            default_theme: themeSettings[0],
            primary_hue: themeSettings[1],
            accent_hue: themeSettings[2],
            allow_location_theme_override: themeSettings[3],
            allow_user_theme_override: themeSettings[4],
          }}
          onChange={(next) => {
            setValue("default_theme", next.default_theme, { shouldDirty: true });
            setValue("primary_hue", next.primary_hue, { shouldDirty: true });
            setValue("accent_hue", next.accent_hue, { shouldDirty: true });
            setValue("allow_location_theme_override", next.allow_location_theme_override, {
              shouldDirty: true,
            });
            setValue("allow_user_theme_override", next.allow_user_theme_override, {
              shouldDirty: true,
            });
          }}
        />
      </OrgSettingsSection>
    </>
  );
}
