"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveCorporateProfile } from "@/app/onboarding/actions";
import { COUNTRY_OPTIONS } from "@/lib/onboarding/locale-presets";
import type {
  CorporateProfileFormValues,
  PrimaryLocation,
  StepSubmitHandle,
  TenantProfile,
} from "@/lib/onboarding/types";

const schema = z.object({
  company_name: z.string().min(1, "Company name required"),
  legal_registration_number: z.string().min(1, "Registration number required"),
  tax_identifier: z.string().min(1, "Tax identifier required"),
  name: z.string().min(1, "Location name required"),
  code: z.string().min(1, "Warehouse code required"),
  address_line1: z.string().min(1, "Address required"),
  city: z.string().min(1, "City required"),
  state: z.string().min(1, "State required"),
  zip_postal: z.string().min(1, "Postal code required"),
  country_code: z.string().length(2, "Use 2-letter country code"),
  billing_state: z.string().optional(),
  shipping_state: z.string().optional(),
  tax_registered_name: z.string().optional(),
  location_tax_identifier: z.string().optional(),
});

type Props = {
  completed: boolean;
  tenant: TenantProfile;
  primaryLocation: PrimaryLocation | null;
  defaultValues?: Partial<CorporateProfileFormValues>;
  showAdvanced: boolean;
  onDraftChange?: (values: Partial<CorporateProfileFormValues>) => void;
  onEditingChange?: (editing: boolean) => void;
};

export const StepCorporateProfile = forwardRef<StepSubmitHandle, Props>(function StepCorporateProfile(
  { completed, tenant, primaryLocation, defaultValues, showAdvanced, onDraftChange, onEditingChange },
  ref
) {
  const [isEditing, setIsEditing] = useState(!completed);

  const setEditing = (value: boolean) => {
    setIsEditing(value);
    onEditingChange?.(value);
  };

  const form = useForm<CorporateProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: tenant.name || "",
      legal_registration_number: tenant.legal_registration_number || "",
      tax_identifier: tenant.tax_identifier || "",
      country_code: defaultValues?.country_code || "US",
      billing_state: "",
      shipping_state: "",
      ...defaultValues,
    },
  });

  useImperativeHandle(ref, () => ({
    submit: async () => {
      const valid = await form.trigger();
      if (!valid) return { error: "Please complete all required fields" };
      const result = await saveCorporateProfile(form.getValues());
      if (!result.error) setEditing(false);
      return result;
    },
  }));

  if (completed && primaryLocation && !isEditing) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
          <p className="font-medium">{tenant.name}</p>
          <p className="text-muted-foreground">
            Reg. {tenant.legal_registration_number || "—"} · Tax ID {tenant.tax_identifier || "—"}
          </p>
          <p className="text-muted-foreground">
            {primaryLocation.name} · {primaryLocation.city}, {primaryLocation.state}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit company &amp; location
        </Button>
      </div>
    );
  }

  const registerWithDraft = (
    field: keyof CorporateProfileFormValues,
    options?: Parameters<typeof form.register>[1]
  ) =>
    form.register(field, {
      ...options,
      onChange: (event) => {
        options?.onChange?.(event);
        onDraftChange?.({ ...form.getValues(), [field]: event.target.value });
      },
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Company Name</Label>
          <Input {...registerWithDraft("company_name")} placeholder="Acme Corporation" />
          {form.formState.errors.company_name && (
            <p className="text-sm text-destructive">{form.formState.errors.company_name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Business Registration Number</Label>
          <Input {...registerWithDraft("legal_registration_number")} placeholder="CIN / EIN / CRN" />
          {form.formState.errors.legal_registration_number && (
            <p className="text-sm text-destructive">
              {form.formState.errors.legal_registration_number.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Tax Identifier</Label>
          <Input {...registerWithDraft("tax_identifier")} placeholder="GSTIN / VAT / EIN" />
          {form.formState.errors.tax_identifier && (
            <p className="text-sm text-destructive">{form.formState.errors.tax_identifier.message}</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Home Location</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Warehouse / Location Name</Label>
            <Input {...registerWithDraft("name")} placeholder="Central Warehouse" />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Location Code</Label>
            <Input {...registerWithDraft("code")} placeholder="WH-001" />
            {form.formState.errors.code && (
              <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Address Line 1</Label>
            <Input {...registerWithDraft("address_line1")} />
            {form.formState.errors.address_line1 && (
              <p className="text-sm text-destructive">{form.formState.errors.address_line1.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input {...registerWithDraft("city")} />
            {form.formState.errors.city && (
              <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>State / Province</Label>
            <Input {...registerWithDraft("state")} />
            {form.formState.errors.state && (
              <p className="text-sm text-destructive">{form.formState.errors.state.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Postal Code</Label>
            <Input {...registerWithDraft("zip_postal")} />
            {form.formState.errors.zip_postal && (
              <p className="text-sm text-destructive">{form.formState.errors.zip_postal.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Select
              value={form.watch("country_code")}
              onValueChange={(value) => {
                form.setValue("country_code", value, { shouldValidate: true });
                onDraftChange?.({ ...form.getValues(), country_code: value });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.country_code && (
              <p className="text-sm text-destructive">{form.formState.errors.country_code.message}</p>
            )}
          </div>
        </div>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 border-t pt-4">
          <div className="space-y-2">
            <Label>Billing State (Nexus)</Label>
            <Input {...registerWithDraft("billing_state")} />
          </div>
          <div className="space-y-2">
            <Label>Shipping State (Nexus)</Label>
            <Input {...registerWithDraft("shipping_state")} />
          </div>
          <div className="space-y-2">
            <Label>Tax Registered Name</Label>
            <Input {...registerWithDraft("tax_registered_name")} />
          </div>
          <div className="space-y-2">
            <Label>Regional Tax Identifier</Label>
            <Input
              {...registerWithDraft("location_tax_identifier")}
              placeholder="GSTIN / State Tax ID"
            />
          </div>
        </div>
      )}
    </div>
  );
});
