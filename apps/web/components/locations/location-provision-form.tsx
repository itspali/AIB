"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { saveLocation, suggestLocationCode } from "@/app/inventory/locations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eligibleParentLocations, hierarchyEnabled } from "@/lib/locations/governance";
import { buildLocationCodeSuggestInput } from "@/lib/locations/code-generation";
import { presenceLabel } from "@/lib/locations/axis-labels";
import { PRESENCE_ENVIRONMENTS, type LocationFormValues, type LocationRow } from "@/lib/locations/types";
import type { OrganizationLocationGovernanceConfig } from "@/lib/organization/types";
import { COUNTRY_OPTIONS } from "@/lib/organization/country-options";
import { cn } from "@/lib/utils";

type Props = {
  rows: LocationRow[];
  governance: OrganizationLocationGovernanceConfig;
  editingLocation?: LocationRow | null;
  onDiscard: () => void;
  onSaved: (locationId: string) => void;
};

const defaultForm: LocationFormValues = {
  location_id: null,
  name: "",
  code: "",
  presence_type: "PHYSICAL",
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
  is_administrative_office: false,
  is_commercial_storefront: false,
  is_manufacturing_floor: false,
  is_stock_holding: false,
  pos_terminal_count: 0,
  location_tax_identifier: "",
  tax_registered_name: "",
  show_advanced: false,
};

function normalizeVirtualAddress(form: LocationFormValues): LocationFormValues {
  if (form.presence_type !== "VIRTUAL") return form;
  return {
    ...form,
    address_line1: form.address_line1.trim() || "Virtual presence node",
    city: form.city.trim() || "Virtual",
    state: form.state.trim() || "NA",
    zip_postal: form.zip_postal.trim() || "00000",
  };
}

export function LocationProvisionForm({
  rows,
  governance,
  editingLocation = null,
  onDiscard,
  onSaved,
}: Props) {
  const router = useRouter();
  const isEditing = Boolean(editingLocation);
  const [form, setForm] = useState<LocationFormValues>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const codeManuallyEditedRef = useRef(false);
  const lastSuggestionRef = useRef<LocationFormValues["code_generation"]>(null);

  const useHierarchy = hierarchyEnabled(governance);
  const parentOptions = useMemo(
    () => eligibleParentLocations(rows, editingLocation?.id ?? null),
    [rows, editingLocation?.id]
  );

  useEffect(() => {
    if (editingLocation) {
      codeManuallyEditedRef.current = true;
      lastSuggestionRef.current = null;
      setForm({
        location_id: editingLocation.id,
        name: editingLocation.name,
        code: editingLocation.code,
        presence_type: editingLocation.presence_type,
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
        is_administrative_office: editingLocation.is_administrative_office,
        is_commercial_storefront: editingLocation.is_commercial_storefront,
        is_manufacturing_floor: editingLocation.is_manufacturing_floor,
        is_stock_holding: editingLocation.is_stock_holding,
        pos_terminal_count: editingLocation.pos_terminal_count,
        location_tax_identifier: editingLocation.location_tax_identifier ?? "",
        tax_registered_name: editingLocation.tax_registered_name ?? "",
        show_advanced: Boolean(
          editingLocation.parent_location_id ||
            editingLocation.manager_name ||
            editingLocation.location_tax_identifier ||
            editingLocation.is_administrative_office ||
            editingLocation.is_commercial_storefront ||
            editingLocation.is_manufacturing_floor ||
            editingLocation.is_stock_holding ||
            editingLocation.pos_terminal_count > 0 ||
            editingLocation.address_line2
        ),
      });
    } else {
      codeManuallyEditedRef.current = false;
      lastSuggestionRef.current = null;
      setForm(defaultForm);
    }
    setError(null);
  }, [editingLocation]);

  const applySuggestedCode = async (force = false) => {
    if (isEditing) return;
    if (!force && codeManuallyEditedRef.current) return;

    setIsSuggesting(true);
    const result = await suggestLocationCode(buildLocationCodeSuggestInput(form));
    setIsSuggesting(false);

    if ("error" in result) {
      if (force) toast.error(result.error ?? "Unable to suggest a facility code.");
      return;
    }

    const suggestion = result.suggestion;
    lastSuggestionRef.current = {
      scope: suggestion.scope,
      role: suggestion.role,
      sequence: suggestion.sequence,
      role_key: suggestion.role_key,
      suggested_code: suggestion.code,
    };

    setForm((prev) => ({
      ...prev,
      code: suggestion.code,
      code_generation: lastSuggestionRef.current,
      code_manually_edited: false,
    }));
  };

  useEffect(() => {
    if (isEditing) return;

    const timer = window.setTimeout(() => {
      void applySuggestedCode();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    isEditing,
    form.presence_type,
    form.parent_location_id,
    form.country_code,
    form.city,
    form.is_administrative_office,
    form.is_commercial_storefront,
    form.is_manufacturing_floor,
    form.is_stock_holding,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const payload = normalizeVirtualAddress({
        ...form,
        code_manually_edited: codeManuallyEditedRef.current,
        code_generation: lastSuggestionRef.current,
      });
          const result = await saveLocation(payload);
          if ("error" in result) {
            setError(result.error ?? "Unable to save facility node.");
            return;
          }

          toast.success(isEditing ? "Facility node updated." : "Facility node provisioned.");
          router.refresh();
          onSaved(result.locationId);
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [form, isEditing, onSaved, router]);

  const updateField = <K extends keyof LocationFormValues>(key: K, value: LocationFormValues[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "presence_type" && value === "VIRTUAL") {
        next.is_stock_holding = false;
        next.is_manufacturing_floor = false;
      }
      if (key === "is_commercial_storefront") {
        next.pos_terminal_count = value ? Math.max(1, prev.pos_terminal_count || 1) : 0;
      }
      if (key === "code" && typeof value === "string") {
        next.code = value.toUpperCase();
        codeManuallyEditedRef.current = true;
        next.code_manually_edited = true;
        next.code_generation = lastSuggestionRef.current;
      }
      return next;
    });
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const payload = normalizeVirtualAddress({
        ...form,
        code_manually_edited: codeManuallyEditedRef.current,
        code_generation: lastSuggestionRef.current,
      });
      const result = await saveLocation(payload);
      if ("error" in result) {
        setError(result.error ?? "Unable to save facility node.");
        return;
      }

      toast.success(isEditing ? "Facility node updated." : "Facility node provisioned.");
      router.refresh();
      onSaved(result.locationId);
    });
  };

  const stockToggleDisabled = form.presence_type === "VIRTUAL";
  const manufacturingToggleDisabled = form.presence_type === "VIRTUAL";

  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <header className="mb-6">
        <h2 className="text-xl font-semibold">
          {isEditing ? "Modify Facility Node" : "Provision Facility Node"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Essentials-first axis configuration for presence, hierarchy placement, and operational
          capabilities.
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Core Presentation Matrix
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Environment presence</Label>
              <div className="inline-flex rounded-lg border border-border p-1">
                {PRESENCE_ENVIRONMENTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateField("presence_type", value)}
                    className={cn(
                      "rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200",
                      form.presence_type === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {presenceLabel(value)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facility-name">Custom branch name</Label>
              <Input
                id="facility-name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Mumbai Regional Hub"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="facility-code">Short system identifier code</Label>
                {!isEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={isSuggesting}
                    onClick={() => void applySuggestedCode(true)}
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    {isSuggesting ? "Suggesting…" : "Suggest code"}
                  </Button>
                )}
              </div>
              <Input
                id="facility-code"
                value={form.code}
                onChange={(event) => updateField("code", event.target.value)}
                placeholder="MUM-PLANT-04"
                className="font-mono uppercase"
              />
              {!isEditing && form.code && !codeManuallyEditedRef.current && (
                <p className="text-xs text-muted-foreground">
                  System-generated from scope, capability role, and next sequence.
                </p>
              )}
            </div>

            {useHierarchy && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Parent tree assignment</Label>
                <Select
                  value={form.parent_location_id ?? "none"}
                  onValueChange={(value) =>
                    updateField("parent_location_id", value === "none" ? null : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent facility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Root node (no parent)</SelectItem>
                    {parentOptions.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </section>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Show Advanced Parameters</p>
            <p className="text-xs text-muted-foreground">
              Reveal address mapping, inventory rules, POS registry, and manufacturing controls.
            </p>
          </div>
          <Switch
            checked={form.show_advanced}
            onCheckedChange={(checked) => updateField("show_advanced", checked)}
          />
        </div>

        {form.show_advanced && (
          <div className="space-y-4">
            <CapabilityCard title="Administrative / HQ Office">
              <SwitchRow
                label="Mark as business headquarters or administrative office"
                checked={form.is_administrative_office}
                onCheckedChange={(checked) => updateField("is_administrative_office", checked)}
              />
            </CapabilityCard>

            {form.presence_type === "PHYSICAL" && (
              <CapabilityCard title="Physical Workspace Mapping">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Street line 1</Label>
                    <Input
                      value={form.address_line1}
                      onChange={(event) => updateField("address_line1", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Street line 2</Label>
                    <Input
                      value={form.address_line2}
                      onChange={(event) => updateField("address_line2", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={form.city}
                      onChange={(event) => updateField("city", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State / province</Label>
                    <Input
                      value={form.state}
                      onChange={(event) => updateField("state", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Postal code</Label>
                    <Input
                      value={form.zip_postal}
                      onChange={(event) => updateField("zip_postal", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country code</Label>
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
              </CapabilityCard>
            )}

            <CapabilityCard title="Inventory Storage Rules">
              <SwitchRow
                label="Houses physical inventory stock"
                checked={form.is_stock_holding}
                disabled={stockToggleDisabled}
                onCheckedChange={(checked) => updateField("is_stock_holding", checked)}
              />
              {form.is_stock_holding && (
                <div className="mt-3 rounded-md border border-dashed border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                  Warehouse layout zone metrics and bin allocation grids will attach to this node in
                  the inventory module. Stock authority is active for MWAC and shelf slot selectors.
                </div>
              )}
            </CapabilityCard>

            <CapabilityCard title="POS Terminal Registry">
              <SwitchRow
                label="Operates a consumer retail storefront / sales desk"
                checked={form.is_commercial_storefront}
                onCheckedChange={(checked) => updateField("is_commercial_storefront", checked)}
              />
              {form.is_commercial_storefront && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="pos-count">
                    Number of active cash registers / billing terminals
                  </Label>
                  <Input
                    id="pos-count"
                    type="number"
                    min={1}
                    value={form.pos_terminal_count}
                    onChange={(event) =>
                      updateField(
                        "pos_terminal_count",
                        Math.max(1, Number(event.target.value) || 1)
                      )
                    }
                  />
                </div>
              )}
            </CapabilityCard>

            <CapabilityCard title="Manufacturing WIP Center">
              <SwitchRow
                label="Operates as an active manufacturing floor"
                checked={form.is_manufacturing_floor}
                disabled={manufacturingToggleDisabled}
                onCheckedChange={(checked) => updateField("is_manufacturing_floor", checked)}
              />
              {form.is_manufacturing_floor && (
                <div className="mt-3 rounded-md border border-dashed border-red-500/30 bg-red-500/5 p-3 text-sm text-muted-foreground">
                  Unlocks production routing, bill of materials recipe execution, and raw-to-WIP
                  sub-ledger calculations at this site.
                </div>
              )}
            </CapabilityCard>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <footer className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onDiscard} disabled={isPending}>
          Discard
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          title="Save facility node (Cmd/Ctrl + Enter)"
        >
          {isPending ? "Saving…" : "Confirm & Save Facility Node"}
        </Button>
      </footer>
    </div>
  );
}

function CapabilityCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-panel space-y-3 p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </section>
  );
}

function SwitchRow({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm">{label}</p>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
