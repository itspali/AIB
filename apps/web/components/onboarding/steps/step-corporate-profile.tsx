"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { ChevronDown } from "lucide-react";
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
import {
  NEUTRAL_PROFILE_COPY,
  getDefaultLocationDefaults,
} from "@/lib/onboarding/business-model";
import { COUNTRY_OPTIONS } from "@/lib/onboarding/locale-presets";
import { cn } from "@/lib/utils";
import type {
  CorporateProfileFormValues,
  PrimaryLocation,
  StepSubmitHandle,
  TenantProfile,
} from "@/lib/onboarding/types";

const schema = z.object({
  company_name: z.string().min(1, "Name is required"),
  legal_registration_number: z.string().default(""),
  tax_identifier: z.string().default(""),
  name: z.string().min(1, "Location name is required"),
  code: z.string().default("HQ"),
  address_line1: z.string().default(""),
  address_line2: z.string().default(""),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip_postal: z.string().default(""),
  country_code: z.string().length(2, "Use 2-letter country code"),
  billing_state: z.string().default(""),
  shipping_state: z.string().default(""),
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
  {
    completed,
    tenant,
    primaryLocation,
    defaultValues,
    showAdvanced,
    onDraftChange,
    onEditingChange,
  },
  ref
) {
  const profileCopy = NEUTRAL_PROFILE_COPY;
  const locationDefaults = getDefaultLocationDefaults();
  const [isEditing, setIsEditing] = useState(!completed);
  const [complianceOpen, setComplianceOpen] = useState(profileCopy.defaultComplianceExpanded);

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
      name: defaultValues?.name || locationDefaults.name,
      code: defaultValues?.code || locationDefaults.code,
      address_line1: defaultValues?.address_line1 || "",
      address_line2: defaultValues?.address_line2 || "",
      city: defaultValues?.city || "",
      state: defaultValues?.state || "",
      zip_postal: defaultValues?.zip_postal || "",
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
          {(tenant.legal_registration_number || tenant.tax_identifier) && (
            <p className="text-muted-foreground">
              {tenant.legal_registration_number
                ? `Reg. ${tenant.legal_registration_number}`
                : null}
              {tenant.legal_registration_number && tenant.tax_identifier ? " · " : null}
              {tenant.tax_identifier ? `Tax ID ${tenant.tax_identifier}` : null}
            </p>
          )}
          <p className="text-muted-foreground">
            {primaryLocation.name} · {primaryLocation.city}, {primaryLocation.state}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit details
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
      <div className="space-y-2">
        <Label>{profileCopy.businessNameLabel}</Label>
        <Input {...registerWithDraft("company_name")} placeholder="Acme Corporation" />
        {form.formState.errors.company_name && (
          <p className="text-sm text-destructive">{form.formState.errors.company_name.message}</p>
        )}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">{profileCopy.locationSectionTitle}</p>
        <p className="mb-3 text-xs text-muted-foreground">{profileCopy.locationSectionHint}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{profileCopy.locationNameLabel}</Label>
            <Input {...registerWithDraft("name")} placeholder={locationDefaults.name} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Location code</Label>
            <Input {...registerWithDraft("code")} placeholder={locationDefaults.code} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address line 1</Label>
            <Input {...registerWithDraft("address_line1")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address line 2 (optional)</Label>
            <Input {...registerWithDraft("address_line2")} />
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
            <Label>Postal code</Label>
            <Input {...registerWithDraft("zip_postal")} />
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

      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 p-4 text-left"
          onClick={() => setComplianceOpen((open) => !open)}
        >
          <div>
            <p className="text-sm font-medium">{profileCopy.compliancePanelTitle}</p>
            <p className="text-xs text-muted-foreground">{profileCopy.compliancePanelHint}</p>
          </div>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", {
              "rotate-180": complianceOpen,
            })}
          />
        </button>
        {complianceOpen && (
          <div className="grid grid-cols-1 gap-4 border-t p-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{profileCopy.registrationLabel}</Label>
              <Input {...registerWithDraft("legal_registration_number")} placeholder="CIN / EIN / CRN" />
            </div>
            <div className="space-y-2">
              <Label>{profileCopy.taxIdLabel}</Label>
              <Input {...registerWithDraft("tax_identifier")} placeholder="GSTIN / VAT / EIN" />
            </div>
          </div>
        )}
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 border-t pt-4">
          <div className="space-y-2">
            <Label>Billing state (nexus)</Label>
            <Input {...registerWithDraft("billing_state")} />
          </div>
          <div className="space-y-2">
            <Label>Shipping state (nexus)</Label>
            <Input {...registerWithDraft("shipping_state")} />
          </div>
          <div className="space-y-2">
            <Label>Tax registered name</Label>
            <Input {...registerWithDraft("tax_registered_name")} />
          </div>
          <div className="space-y-2">
            <Label>Regional tax identifier</Label>
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
