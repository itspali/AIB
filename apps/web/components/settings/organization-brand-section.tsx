"use client";

import type { UseFormReturn } from "react-hook-form";
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

  return (
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
  );
}
