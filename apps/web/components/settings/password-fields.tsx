"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfileSettingsFormValues } from "@/lib/settings/types";

type Props = {
  form: UseFormReturn<ProfileSettingsFormValues>;
  disabled?: boolean;
};

export function PasswordFields({ form, disabled }: Props) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="current_password" className="text-sm font-medium text-muted-foreground">
          Current password
        </Label>
        <Input
          id="current_password"
          type="password"
          autoComplete="current-password"
          disabled={disabled}
          {...register("current_password")}
        />
        {errors.current_password && (
          <p className="text-xs text-destructive">{errors.current_password.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="new_password" className="text-sm font-medium text-muted-foreground">
          New password
        </Label>
        <Input
          id="new_password"
          type="password"
          autoComplete="new-password"
          disabled={disabled}
          {...register("new_password")}
        />
        {errors.new_password && (
          <p className="text-xs text-destructive">{errors.new_password.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_password" className="text-sm font-medium text-muted-foreground">
          Confirm new password
        </Label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          disabled={disabled}
          {...register("confirm_password")}
        />
        {errors.confirm_password && (
          <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
        )}
      </div>
    </div>
  );
}
