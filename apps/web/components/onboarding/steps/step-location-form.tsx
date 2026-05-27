"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveLocation } from "@/app/onboarding/actions";
import type { LocationFormValues, PrimaryLocation } from "@/lib/onboarding/types";

const schema = z.object({
  name: z.string().min(1, "Location name required"),
  code: z.string().min(1, "Warehouse code required"),
  address_line1: z.string().min(1, "Address required"),
  city: z.string().min(1, "City required"),
  state: z.string().min(1, "State required"),
  zip_postal: z.string().min(1, "Postal code required"),
  country_code: z.string().length(2, "Use 2-letter country code"),
  billing_state: z.string().min(1, "Billing state required"),
  shipping_state: z.string().min(1, "Shipping state required"),
  tax_registered_name: z.string().optional(),
  location_tax_identifier: z.string().optional(),
});

type Props = {
  completed: boolean;
  primaryLocation: PrimaryLocation | null;
  defaultValues?: Partial<LocationFormValues>;
};

export function StepLocationForm({ completed, primaryLocation, defaultValues }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      country_code: "US",
      ...defaultValues,
    },
  });

  if (completed && primaryLocation) {
    return (
      <div className="rounded-md border bg-muted/30 p-4 text-sm">
        <p className="font-medium">{primaryLocation.name}</p>
        <p className="text-muted-foreground">
          {primaryLocation.tax_registered_name || primaryLocation.name} ·{" "}
          {primaryLocation.location_tax_identifier || "No tax ID"} · {primaryLocation.city},{" "}
          {primaryLocation.state}
        </p>
      </div>
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await saveLocation(values);
      if (result.error) setError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save Location"}
      </Button>
    </form>
  );
}
