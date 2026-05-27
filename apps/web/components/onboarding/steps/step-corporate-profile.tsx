"use client";

import { forwardRef, useImperativeHandle } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCorporateProfile } from "@/app/onboarding/actions";
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
};

export const StepCorporateProfile = forwardRef<StepSubmitHandle, Props>(function StepCorporateProfile(
  { completed, tenant, primaryLocation, defaultValues, showAdvanced },
  ref
) {
  const form = useForm<CorporateProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: tenant.name || "",
      legal_registration_number: tenant.legal_registration_number || "",
      tax_identifier: tenant.tax_identifier || "",
      country_code: "US",
      billing_state: "",
      shipping_state: "",
      ...defaultValues,
    },
  });

  useImperativeHandle(ref, () => ({
    submit: async () => {
      const valid = await form.trigger();
      if (!valid) return { error: "Please complete all required fields" };
      return saveCorporateProfile(form.getValues());
    },
  }));

  if (completed && primaryLocation) {
    return (
      <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-medium">{tenant.name}</p>
        <p className="text-muted-foreground">
          Reg. {tenant.legal_registration_number || "—"} · Tax ID {tenant.tax_identifier || "—"}
        </p>
        <p className="text-muted-foreground">
          {primaryLocation.name} · {primaryLocation.city}, {primaryLocation.state}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Company Name</Label>
          <Input {...form.register("company_name")} placeholder="Acme Corporation" />
        </div>
        <div className="space-y-2">
          <Label>Business Registration Number</Label>
          <Input {...form.register("legal_registration_number")} placeholder="CIN / EIN / CRN" />
        </div>
        <div className="space-y-2">
          <Label>Tax Identifier</Label>
          <Input {...form.register("tax_identifier")} placeholder="GSTIN / VAT / EIN" />
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Home Location</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Warehouse / Location Name</Label>
            <Input {...form.register("name")} placeholder="Central Warehouse" />
          </div>
          <div className="space-y-2">
            <Label>Location Code</Label>
            <Input {...form.register("code")} placeholder="WH-001" />
          </div>
          <div className="space-y-2">
            <Label>Address Line 1</Label>
            <Input {...form.register("address_line1")} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input {...form.register("city")} />
          </div>
          <div className="space-y-2">
            <Label>State / Province</Label>
            <Input {...form.register("state")} />
          </div>
          <div className="space-y-2">
            <Label>Postal Code</Label>
            <Input {...form.register("zip_postal")} />
          </div>
          <div className="space-y-2">
            <Label>Country Code</Label>
            <Input {...form.register("country_code")} maxLength={2} className="uppercase" />
          </div>
        </div>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 border-t pt-4">
          <div className="space-y-2">
            <Label>Billing State (Nexus)</Label>
            <Input {...form.register("billing_state")} />
          </div>
          <div className="space-y-2">
            <Label>Shipping State (Nexus)</Label>
            <Input {...form.register("shipping_state")} />
          </div>
          <div className="space-y-2">
            <Label>Tax Registered Name</Label>
            <Input {...form.register("tax_registered_name")} />
          </div>
          <div className="space-y-2">
            <Label>Regional Tax Identifier</Label>
            <Input {...form.register("location_tax_identifier")} placeholder="GSTIN / State Tax ID" />
          </div>
        </div>
      )}
    </div>
  );
});
