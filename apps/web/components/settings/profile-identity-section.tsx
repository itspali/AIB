"use client";

import type { UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarUploader } from "@/components/settings/avatar-uploader";
import type { ProfileSettingsFormValues } from "@/lib/settings/types";

type Props = {
  form: UseFormReturn<ProfileSettingsFormValues>;
  email: string;
  tenantId: string;
  userId: string;
  avatarPreviewUrl?: string | null;
  disabled?: boolean;
};

export function ProfileIdentitySection({
  form,
  email,
  tenantId,
  userId,
  avatarPreviewUrl,
  disabled,
}: Props) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  return (
    <section className="space-y-4 rounded-xl border border-border/80 bg-card/50 p-4 dark:border-white/10">
      <h2 className="text-xl font-semibold">Personal Worker Identity</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name" className="text-sm font-medium text-muted-foreground">
            First name
          </Label>
          <Input id="first_name" disabled={disabled} {...register("first_name")} />
          {errors.first_name && (
            <p className="text-xs text-destructive">{errors.first_name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name" className="text-sm font-medium text-muted-foreground">
            Last name
          </Label>
          <Input id="last_name" disabled={disabled} {...register("last_name")} />
          {errors.last_name && (
            <p className="text-xs text-destructive">{errors.last_name.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Corporate email</Label>
        <Badge variant="locked" className="font-normal">
          {email}
        </Badge>
        <p className="text-xs text-muted-foreground">
          Email changes require a verified security workflow and cannot be edited here.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone_number" className="text-sm font-medium text-muted-foreground">
          Direct work phone
        </Label>
        <Input
          id="phone_number"
          placeholder="+12125550123"
          disabled={disabled}
          {...register("phone_number")}
        />
        {errors.phone_number && (
          <p className="text-xs text-destructive">{errors.phone_number.message}</p>
        )}
      </div>

      <AvatarUploader
        tenantId={tenantId}
        userId={userId}
        value={watch("avatar_url")}
        previewUrl={avatarPreviewUrl}
        disabled={disabled}
        onUploaded={(path) => setValue("avatar_url", path, { shouldDirty: true })}
      />
    </section>
  );
}
