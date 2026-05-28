"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveLocation } from "@/app/inventory/locations/actions";
import { RightDrawer } from "@/components/ui/right-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultStockHoldingForType } from "@/lib/locations/capabilities";
import {
  eligibleParentLocations,
  hierarchyEnabled,
} from "@/lib/locations/governance";
import {
  enterpriseLocationTypeOptions,
  flatLocationTypeOptions,
} from "@/lib/locations/location-type-options";
import type { LocationFormValues, LocationRow } from "@/lib/locations/types";
import type { OrganizationLocationGovernanceConfig } from "@/lib/organization/types";
import { COUNTRY_OPTIONS } from "@/lib/organization/country-options";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: LocationRow[];
  governance: OrganizationLocationGovernanceConfig;
  editingLocation?: LocationRow | null;
  onSaved: (locationId: string) => void;
};

const defaultForm: LocationFormValues = {
  location_id: null,
  name: "",
  code: "",
  location_type: "STORAGE_WAREHOUSE",
  parent_location_id: null,
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip_postal: "",
  country_code: "IN",
  manager_name: "",
  contact_email: "",
  contact_phone: "",
  is_stock_holding: true,
  location_tax_identifier: "",
  tax_registered_name: "",
  show_advanced: false,
};

export function LocationDrawerForm({
  open,
  onOpenChange,
  rows,
  governance,
  editingLocation = null,
  onSaved,
}: Props) {
  const router = useRouter();
  const isEditing = Boolean(editingLocation);
  const [form, setForm] = useState<LocationFormValues>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const useHierarchy = hierarchyEnabled(governance);
  const typeOptions = useHierarchy ? enterpriseLocationTypeOptions() : flatLocationTypeOptions();

  const parentOptions = useMemo(
    () =>
      eligibleParentLocations(rows, form.location_type, editingLocation?.id ?? null),
    [rows, form.location_type, editingLocation?.id]
  );

  useEffect(() => {
    if (!open) return;

    if (editingLocation) {
      setForm({
        location_id: editingLocation.id,
        name: editingLocation.name,
        code: editingLocation.code,
        location_type: editingLocation.location_type as LocationFormValues["location_type"],
        parent_location_id: editingLocation.parent_location_id,
        address_line1: editingLocation.address_line1,
        address_line2: editingLocation.address_line2 ?? "",
        city: editingLocation.city,
        state: editingLocation.state,
        zip_postal: editingLocation.zip_postal,
        country_code: editingLocation.country_code as LocationFormValues["country_code"],
        manager_name: editingLocation.manager_name ?? "",
        contact_email: editingLocation.contact_email ?? "",
        contact_phone: editingLocation.contact_phone ?? "",
        is_stock_holding: editingLocation.is_stock_holding,
        location_tax_identifier: editingLocation.location_tax_identifier ?? "",
        tax_registered_name: editingLocation.tax_registered_name ?? "",
        show_advanced: Boolean(
          editingLocation.parent_location_id ||
            editingLocation.manager_name ||
            editingLocation.location_tax_identifier
        ),
      });
    } else {
      setForm(defaultForm);
    }
    setError(null);
  }, [open, editingLocation]);

  const handleClose = () => {
    onOpenChange(false);
    setForm(defaultForm);
    setError(null);
  };

  const updateField = <K extends keyof LocationFormValues>(key: K, value: LocationFormValues[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "location_type") {
        next.is_stock_holding = defaultStockHoldingForType(
          value as LocationFormValues["location_type"]
        );
        next.parent_location_id = null;
      }
      return next;
    });
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveLocation(form);
      if ("error" in result) {
        setError(result.error ?? "Unable to save location.");
        return;
      }

      toast.success(isEditing ? "Location updated." : "Location created.");
      router.refresh();
      onSaved(result.locationId);
      handleClose();
    });
  };

  const stockToggleDisabled =
    form.location_type === "OFFICE_BRANCH" || form.location_type === "VIRTUAL_STOREFRONT";

  return (
    <RightDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit location" : "Create location"}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Configure operational site details and hierarchy placement.
      </p>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input value={form.code} onChange={(e) => updateField("code", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Location type</Label>
            <Select
              value={form.location_type}
              onValueChange={(value) =>
                updateField("location_type", value as LocationFormValues["location_type"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Address line 1</Label>
            <Input
              value={form.address_line1}
              onChange={(e) => updateField("address_line1", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => updateField("city", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input value={form.state} onChange={(e) => updateField("state", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Postal code</Label>
            <Input
              value={form.zip_postal}
              onChange={(e) => updateField("zip_postal", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Select
              value={form.country_code}
              onValueChange={(value) =>
                updateField("country_code", value as LocationFormValues["country_code"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="px-0 text-primary"
          onClick={() => updateField("show_advanced", !form.show_advanced)}
        >
          {form.show_advanced ? "Hide advanced fields" : "Show advanced fields"}
        </Button>

        {form.show_advanced && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            {useHierarchy && (
              <div className="space-y-2">
                <Label>Parent location</Label>
                <Select
                  value={form.parent_location_id ?? "none"}
                  onValueChange={(value) =>
                    updateField("parent_location_id", value === "none" ? null : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent (root eligible only)</SelectItem>
                    {parentOptions.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Address line 2</Label>
              <Input
                value={form.address_line2}
                onChange={(e) => updateField("address_line2", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Manager</Label>
                <Input
                  value={form.manager_name}
                  onChange={(e) => updateField("manager_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact email</Label>
                <Input
                  value={form.contact_email}
                  onChange={(e) => updateField("contact_email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact phone</Label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => updateField("contact_phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax identifier</Label>
                <Input
                  value={form.location_tax_identifier}
                  onChange={(e) => updateField("location_tax_identifier", e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Stock holding location</p>
                <p className="text-xs text-muted-foreground">
                  Enables inventory counting, MWAC, and shelf slot tools.
                </p>
              </div>
              <Switch
                checked={form.is_stock_holding}
                disabled={stockToggleDisabled}
                onCheckedChange={(checked) => updateField("is_stock_holding", checked)}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : isEditing ? "Save changes" : "Create location"}
          </Button>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </RightDrawer>
  );
}
