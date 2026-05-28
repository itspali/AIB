"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { deactivateLocation, reactivateLocation } from "@/app/inventory/locations/actions";
import { LocationDetailViewport } from "@/components/locations/location-detail-viewport";
import { LocationGovernanceBanner } from "@/components/locations/location-governance-banner";
import { LocationHierarchyRail } from "@/components/locations/location-hierarchy-rail";
import { LocationModuleHeader } from "@/components/locations/location-module-header";
import { LocationPristineCanvas } from "@/components/locations/location-pristine-canvas";
import { LocationProvisionForm } from "@/components/locations/location-provision-form";
import { Button } from "@/components/ui/button";
import { canAddLocation } from "@/lib/locations/governance";
import type { LocationModuleContext, LocationRow } from "@/lib/locations/types";
import { cn } from "@/lib/utils";

type Props = {
  initialRows: LocationRow[];
  moduleContext: LocationModuleContext;
};

type CanvasMode = "empty" | "detail" | "form";

export function LocationManagementTerminal({ initialRows, moduleContext }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("empty");
  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeRows = initialRows.filter((row) => row.is_active);
  const selectedLocation = initialRows.find((row) => row.id === selectedId) ?? null;
  const canAdd = canAddLocation(moduleContext.governance, activeRows.length);
  const canProvision = moduleContext.canManage && canAdd;

  const openProvision = () => {
    setEditingLocation(null);
    setCanvasMode("form");
  };

  const openEdit = () => {
    if (!selectedLocation) return;
    setEditingLocation(selectedLocation);
    setCanvasMode("form");
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setCanvasMode("detail");
    setEditingLocation(null);
  };

  const handleDiscard = () => {
    setEditingLocation(null);
    setCanvasMode(selectedLocation ? "detail" : "empty");
  };

  const handleSaved = (locationId: string) => {
    setSelectedId(locationId);
    setEditingLocation(null);
    setCanvasMode("detail");
  };

  const handleDeactivate = () => {
    if (!selectedLocation) return;
    startTransition(async () => {
      const result = await deactivateLocation(selectedLocation.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to deactivate facility node.");
        return;
      }
      toast.success("Facility node deactivated.");
    });
  };

  const handleReactivate = () => {
    if (!selectedLocation) return;
    startTransition(async () => {
      const result = await reactivateLocation(selectedLocation.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to reactivate facility node.");
        return;
      }
      toast.success("Facility node reactivated.");
    });
  };

  return (
    <>
      <LocationModuleHeader activeTab="directory" />
      <LocationGovernanceBanner governance={moduleContext.governance} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Hierarchical location and logistical command center for tenant-scoped facility nodes.
        </p>
        {canProvision && (
          <Button onClick={openProvision}>
            <Plus className="h-4 w-4" />
            Provision Facility Node
          </Button>
        )}
      </div>

      <div
        className={cn(
          "grid min-h-[calc(100vh-theme(spacing.16)-12rem)] grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-0",
          "surface-panel overflow-hidden"
        )}
      >
        <aside
          className={cn(
            "col-span-1 border-border/80 p-4 lg:border-r",
            "max-h-[420px] lg:max-h-none lg:h-full lg:overflow-y-auto scrollbar-none"
          )}
        >
          <LocationHierarchyRail
            rows={initialRows}
            selectedId={selectedId}
            onSelect={handleSelect}
            centralHqLocationId={moduleContext.centralHqLocationId}
          />
        </aside>

        <section className="col-span-1 min-h-[520px] p-4 sm:p-6 lg:col-span-2">
          {canvasMode === "form" ? (
            <LocationProvisionForm
              rows={initialRows}
              governance={moduleContext.governance}
              revenueAccounts={moduleContext.revenueAccounts}
              tenantNamingDefaults={moduleContext.tenantNamingDefaults}
              editingLocation={editingLocation}
              onDiscard={handleDiscard}
              onSaved={handleSaved}
            />
          ) : canvasMode === "detail" && selectedLocation ? (
            <LocationDetailViewport
              location={selectedLocation}
              centralHqLocationId={moduleContext.centralHqLocationId}
              canManage={moduleContext.canManage}
              revenueAccounts={moduleContext.revenueAccounts}
              onEdit={openEdit}
              onDeactivate={handleDeactivate}
              onReactivate={handleReactivate}
            />
          ) : (
            <LocationPristineCanvas canProvision={canProvision} onProvision={openProvision} />
          )}
        </section>
      </div>

      {isPending && <span className="sr-only">Updating facility node…</span>}
    </>
  );
}
