"use client";

import Link from "next/link";
import type { UseFormReturn } from "react-hook-form";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  OrganizationSettingsFormValues,
  TenantLocationOption,
} from "@/lib/organization/types";

type Props = {
  form: UseFormReturn<OrganizationSettingsFormValues>;
  locations: TenantLocationOption[];
  disabled?: boolean;
};

function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function OrganizationLocationSection({ form, locations, disabled }: Props) {
  const { watch, setValue } = form;
  const multiLocationEnabled = watch("multi_location_enabled");

  return (
    <OrgSettingsSection
      title="Location Governance"
      description="Multi-site routing topology and stock transfer controls."
    >
      <SwitchRow
        label="Multi-location enabled"
        description="Allow operational routing across multiple warehouse and branch locations."
        checked={watch("multi_location_enabled")}
        disabled={disabled}
        onCheckedChange={(checked) =>
          setValue("multi_location_enabled", checked, { shouldDirty: true })
        }
      />
      <SwitchRow
        label="Regional HQs enabled"
        description="Enable regional headquarters topology controls."
        checked={watch("regional_hqs_enabled")}
        disabled={disabled || !multiLocationEnabled}
        onCheckedChange={(checked) =>
          setValue("regional_hqs_enabled", checked, { shouldDirty: true })
        }
      />
      {!multiLocationEnabled && (
        <p className="text-xs text-muted-foreground">
          Enable multi-location before configuring regional hierarchy.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/inventory/locations"
          className="rounded-lg border border-border px-4 py-3 text-sm transition-colors duration-200 hover:bg-accent"
        >
          <p className="font-medium">Manage locations</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Open the operational location directory.
          </p>
        </Link>
        <Link
          href="/inventory/locations/topology"
          className="rounded-lg border border-border px-4 py-3 text-sm transition-colors duration-200 hover:bg-accent"
        >
          <p className="font-medium">Topology explorer</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Visualize hierarchy and configure DOM routing.
          </p>
        </Link>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Central HQ location</Label>
        <Select
          value={watch("central_hq_location_id") ?? "none"}
          disabled={disabled}
          onValueChange={(value) =>
            setValue("central_hq_location_id", value === "none" ? null : value, {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not assigned</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name} ({location.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SwitchRow
        label="Restrict cross-warehouse stock transfers"
        description="When enabled, inter-location stock movement requires explicit governance approval."
        checked={watch("restrict_cross_warehouse_transfers")}
        disabled={disabled}
        onCheckedChange={(checked) =>
          setValue("restrict_cross_warehouse_transfers", checked, { shouldDirty: true })
        }
      />
    </OrgSettingsSection>
  );
}
