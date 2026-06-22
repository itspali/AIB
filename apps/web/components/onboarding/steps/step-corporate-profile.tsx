"use client";

import { forwardRef, useImperativeHandle } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  TAX_REGISTRATION_STATUS_OPTIONS,
  inferTaxRegistrationStatus,
  registrationLabelForCountry,
  taxIdLabelForCountry,
  type TaxRegistrationStatus,
} from "@/lib/onboarding/tax-registration";
import type {
  CorporateProfileFormValues,
  OnboardingDraft,
  PrimaryLocation,
  StepSubmitHandle,
  TenantProfile,
} from "@/lib/onboarding/types";

const taxStatusSchema = z.enum(["REGISTERED", "NOT_REGISTERED", "EXEMPT"]);

const schema = z
  .object({
    company_name: z.string().min(1, "Name is required"),
    legal_registration_number: z.string().default(""),
    tax_identifier: z.string().default(""),
    tax_registration_status: taxStatusSchema,
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
  })
  .superRefine((values, ctx) => {
    if (values.tax_registration_status === "REGISTERED" && !values.tax_identifier.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tax ID is required when registered for tax",
        path: ["tax_identifier"],
      });
    }
  });

type Props = {
  tenant: TenantProfile;
  primaryLocation: PrimaryLocation | null;
  initialCountryCode: string;
  draft?: OnboardingDraft;
  onDraftChange?: (values: Partial<CorporateProfileFormValues> & { tax_registration_status?: TaxRegistrationStatus }) => void;
};

function buildInitialValues(
  tenant: TenantProfile,
  primaryLocation: PrimaryLocation | null,
  draft: OnboardingDraft | undefined,
  initialCountryCode: string
): CorporateProfileFormValues {
  const locationDefaults = getDefaultLocationDefaults();
  const draftProfile = draft?.corporateProfile ?? draft?.location;
  const taxRegistrationStatus =
    draft?.tax_registration_status ??
    draftProfile?.tax_registration_status ??
    inferTaxRegistrationStatus(tenant.tax_identifier);

  return {
    company_name: tenant.name || draftProfile?.company_name || "",
    legal_registration_number:
      tenant.legal_registration_number || draftProfile?.legal_registration_number || "",
    tax_identifier: tenant.tax_identifier || draftProfile?.tax_identifier || "",
    tax_registration_status: taxRegistrationStatus,
    name: primaryLocation?.name || draftProfile?.name || locationDefaults.name,
    code: primaryLocation?.code || draftProfile?.code || locationDefaults.code,
    address_line1: primaryLocation?.address_line1 || draftProfile?.address_line1 || "",
    address_line2: primaryLocation?.address_line2 || draftProfile?.address_line2 || "",
    city: primaryLocation?.city || draftProfile?.city || "",
    state: primaryLocation?.state || draftProfile?.state || "",
    zip_postal: primaryLocation?.zip_postal || draftProfile?.zip_postal || "",
    country_code:
      draftProfile?.country_code ||
      primaryLocation?.country_code ||
      tenant.country_code ||
      initialCountryCode,
    billing_state: draftProfile?.billing_state || "",
    shipping_state: draftProfile?.shipping_state || "",
    tax_registered_name: primaryLocation?.tax_registered_name || draftProfile?.tax_registered_name || "",
    location_tax_identifier:
      primaryLocation?.location_tax_identifier || draftProfile?.location_tax_identifier || "",
  };
}

export const StepCorporateProfile = forwardRef<StepSubmitHandle, Props>(function StepCorporateProfile(
  { tenant, primaryLocation, initialCountryCode, draft, onDraftChange },
  ref
) {
  const profileCopy = NEUTRAL_PROFILE_COPY;
  const locationDefaults = getDefaultLocationDefaults();

  const form = useForm<CorporateProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildInitialValues(tenant, primaryLocation, draft, initialCountryCode),
  });

  const countryCode = form.watch("country_code");
  const taxRegistrationStatus = form.watch("tax_registration_status");
  const taxIdLabel = taxIdLabelForCountry(countryCode);
  const registrationLabel = registrationLabelForCountry(countryCode);

  useImperativeHandle(ref, () => ({
    submit: async () => {
      const valid = await form.trigger();
      if (!valid) return { error: "Please complete all required fields" };
      const values = form.getValues();
      if (values.tax_registration_status !== "REGISTERED") {
        values.tax_identifier = values.tax_registration_status === "EXEMPT" ? "" : values.tax_identifier;
      }
      return saveCorporateProfile(values);
    },
  }));

  const syncDraft = (patch: Partial<CorporateProfileFormValues> & { tax_registration_status?: TaxRegistrationStatus }) => {
    onDraftChange?.({ ...form.getValues(), ...patch });
  };

  const registerWithDraft = (
    field: keyof CorporateProfileFormValues,
    options?: Parameters<typeof form.register>[1]
  ) =>
    form.register(field, {
      ...options,
      onChange: (event) => {
        options?.onChange?.(event);
        syncDraft({ [field]: event.target.value });
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
              value={countryCode}
              onValueChange={(value) => {
                form.setValue("country_code", value, { shouldValidate: true });
                syncDraft({ country_code: value });
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

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">{profileCopy.compliancePanelTitle}</p>
          <p className="text-xs text-muted-foreground">{profileCopy.compliancePanelHint}</p>
        </div>

        <div className="space-y-2">
          <Label>Tax registration status</Label>
          <Select
            value={taxRegistrationStatus}
            onValueChange={(value) => {
              const status = value as TaxRegistrationStatus;
              form.setValue("tax_registration_status", status, { shouldValidate: true });
              syncDraft({ tax_registration_status: status });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {TAX_REGISTRATION_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {TAX_REGISTRATION_STATUS_OPTIONS.find((option) => option.value === taxRegistrationStatus)
              ?.description}
          </p>
        </div>

        {taxRegistrationStatus === "REGISTERED" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>{taxIdLabel}</Label>
              <Input
                {...registerWithDraft("tax_identifier")}
                placeholder={countryCode === "IN" ? "22AAAAA0000A1Z5" : "Tax registration number"}
              />
              {form.formState.errors.tax_identifier && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.tax_identifier.message}
                </p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{registrationLabel}</Label>
              <Input {...registerWithDraft("legal_registration_number")} placeholder="Optional" />
            </div>
            {countryCode === "IN" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Tax registered name (optional)</Label>
                <Input {...registerWithDraft("tax_registered_name")} />
              </div>
            ) : null}
          </div>
        ) : null}

        {taxRegistrationStatus === "NOT_REGISTERED" ? (
          <p className="text-sm text-muted-foreground">
            You can add {taxIdLabel} later in Settings before issuing tax invoices.
          </p>
        ) : null}

        {taxRegistrationStatus === "EXEMPT" ? (
          <p className="text-sm text-muted-foreground">
            No tax ID is required. Update this in Settings if your status changes.
          </p>
        ) : null}
      </div>
    </div>
  );
});
