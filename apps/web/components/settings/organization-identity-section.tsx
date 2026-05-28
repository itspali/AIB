"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrganizationSettingsFormValues } from "@/lib/organization/types";

type Props = {
  form: UseFormReturn<OrganizationSettingsFormValues>;
  sectionId: string;
  disabled?: boolean;
};

export function OrganizationIdentitySection({ form, sectionId, disabled }: Props) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <section id={sectionId} className="surface-panel scroll-mt-40 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Legal &amp; Contact Identity
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="legal_name" className="text-sm font-medium text-muted-foreground">
            Formal legal entity name
          </Label>
          <Input id="legal_name" disabled={disabled} {...register("legal_name")} />
          {errors.legal_name && (
            <p className="text-xs text-destructive">{errors.legal_name.message}</p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="trade_name" className="text-sm font-medium text-muted-foreground">
            Operating trade name
          </Label>
          <Input id="trade_name" disabled={disabled} {...register("trade_name")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax_identifier" className="text-sm font-medium text-muted-foreground">
            Tax registration (GSTIN / VAT)
          </Label>
          <Input
            id="tax_identifier"
            disabled={disabled}
            className="font-mono"
            {...register("tax_identifier")}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="legal_registration_number"
            className="text-sm font-medium text-muted-foreground"
          >
            Corporate registration number
          </Label>
          <Input
            id="legal_registration_number"
            disabled={disabled}
            className="font-mono"
            {...register("legal_registration_number")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_email" className="text-sm font-medium text-muted-foreground">
            Primary corporate email
          </Label>
          <Input id="primary_email" disabled={disabled} type="email" {...register("primary_email")} />
          {errors.primary_email && (
            <p className="text-xs text-destructive">{errors.primary_email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_phone" className="text-sm font-medium text-muted-foreground">
            Primary corporate phone
          </Label>
          <Input id="primary_phone" disabled={disabled} {...register("primary_phone")} />
          {errors.primary_phone && (
            <p className="text-xs text-destructive">{errors.primary_phone.message}</p>
          )}
        </div>
      </div>
    </section>
  );
}
