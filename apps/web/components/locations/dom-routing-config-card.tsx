"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDomRoutingConfig } from "@/app/inventory/locations/actions";
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
import {
  domStrategyLabel,
  type DomRoutingConfig,
} from "@/lib/locations/dom-routing";
import { DOM_FULFILLMENT_STRATEGIES } from "@/lib/locations/dom-routing";
import type { LocationRow } from "@/lib/locations/types";

type Props = {
  initialConfig: DomRoutingConfig;
  locations: LocationRow[];
  canManage: boolean;
};

export function DomRoutingConfigCard({ initialConfig, locations, canManage }: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const isDirty =
    config.primary_fulfillment_strategy !== initialConfig.primary_fulfillment_strategy ||
    config.local_branch_safety_threshold !== initialConfig.local_branch_safety_threshold ||
    config.central_fallback_location_id !== initialConfig.central_fallback_location_id;

  const fallbackLocations = locations.filter(
    (row) =>
      row.is_active &&
      (row.location_type === "COUNTRY_HQ" ||
        row.location_type === "GLOBAL_HQ" ||
        row.location_type === "STORAGE_WAREHOUSE")
  );

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveDomRoutingConfig({ dom_routing: config });
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save DOM routing configuration.");
        return;
      }
      toast.success("DOM routing configuration saved.");
    });
  };

  return (
    <div className="surface-panel space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Distributed Order Management (DOM) Routing Logic
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Configuration is persisted per tenant. Runtime enforcement activates at order dispatch.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">
          Primary E-commerce Fulfillment Strategy
        </Label>
        <Select
          value={config.primary_fulfillment_strategy}
          disabled={!canManage}
          onValueChange={(value) =>
            setConfig((prev) => ({
              ...prev,
              primary_fulfillment_strategy: value as DomRoutingConfig["primary_fulfillment_strategy"],
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOM_FULFILLMENT_STRATEGIES.map((strategy) => (
              <SelectItem key={strategy} value={strategy}>
                {domStrategyLabel(strategy)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {config.primary_fulfillment_strategy === "CENTRAL_FALLBACK_CDC" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Central fallback location</Label>
          <Select
            value={config.central_fallback_location_id ?? "none"}
            disabled={!canManage}
            onValueChange={(value) =>
              setConfig((prev) => ({
                ...prev,
                central_fallback_location_id: value === "none" ? null : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select CDC location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Use central HQ default</SelectItem>
              {fallbackLocations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name} ({location.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">
          Stock Level Safety Threshold
        </Label>
        <Input
          type="number"
          min={0}
          step={1}
          disabled={!canManage}
          value={config.local_branch_safety_threshold}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              local_branch_safety_threshold: Math.max(0, Number(e.target.value) || 0),
            }))
          }
        />
        <p className="text-xs text-muted-foreground">
          Minimum on-hand buffer required before auto-routing delegates picking to a local branch.
        </p>
      </div>

      <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-xs text-muted-foreground">
        Configuration saved; enforcement activates at order dispatch (V2 runtime resolver).
      </div>

      {canManage && (
        <Button onClick={handleSave} disabled={!isDirty || isPending}>
          {isPending ? "Saving…" : "Save routing logic"}
        </Button>
      )}
    </div>
  );
}
