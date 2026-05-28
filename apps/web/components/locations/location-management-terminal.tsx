"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { deactivateLocation, reactivateLocation } from "@/app/inventory/locations/actions";
import { LocationDetailViewport } from "@/components/locations/location-detail-viewport";
import { LocationDrawerForm } from "@/components/locations/location-drawer-form";
import { LocationGovernanceBanner } from "@/components/locations/location-governance-banner";
import { LocationModuleHeader } from "@/components/locations/location-module-header";
import { LocationStreamPanel } from "@/components/locations/location-stream-panel";
import { Button } from "@/components/ui/button";
import { canAddLocation } from "@/lib/locations/governance";
import type { LocationModuleContext, LocationRow } from "@/lib/locations/types";
import { cn } from "@/lib/utils";

type Props = {
  initialRows: LocationRow[];
  moduleContext: LocationModuleContext;
};

export function LocationManagementTerminal({ initialRows, moduleContext }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeRows = initialRows.filter((row) => row.is_active);
  const selectedLocation =
    initialRows.find((row) => row.id === selectedId) ??
    activeRows[0] ??
    initialRows[0] ??
    null;

  const canAdd = canAddLocation(moduleContext.governance, activeRows.length);

  const openCreate = () => {
    setEditingLocation(null);
    setDrawerOpen(true);
  };

  const openEdit = () => {
    if (!selectedLocation) return;
    setEditingLocation(selectedLocation);
    setDrawerOpen(true);
  };

  const handleDeactivate = () => {
    if (!selectedLocation) return;
    startTransition(async () => {
      const result = await deactivateLocation(selectedLocation.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to deactivate location.");
        return;
      }
      toast.success("Location deactivated.");
    });
  };

  const handleReactivate = () => {
    if (!selectedLocation) return;
    startTransition(async () => {
      const result = await reactivateLocation(selectedLocation.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to reactivate location.");
        return;
      }
      toast.success("Location reactivated.");
    });
  };

  return (
    <>
      <LocationModuleHeader activeTab="directory" />
      <LocationGovernanceBanner governance={moduleContext.governance} />

      <div className="mb-4 flex justify-end">
        {moduleContext.canManage && canAdd && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add location
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-0">
        <aside
          className={cn(
            "col-span-1 lg:col-span-4",
            "border-border/80 lg:border-r lg:pr-4",
            "h-auto lg:h-[calc(100vh-theme(spacing.16)-4rem)]",
            "overflow-y-auto scrollbar-none"
          )}
        >
          <LocationStreamPanel
            rows={initialRows}
            selectedId={selectedLocation?.id ?? null}
            onSelect={setSelectedId}
            centralHqLocationId={moduleContext.centralHqLocationId}
          />
        </aside>

        <section className="col-span-1 min-h-[420px] w-full p-4 sm:p-6 lg:col-span-8">
          {selectedLocation ? (
            <LocationDetailViewport
              location={selectedLocation}
              centralHqLocationId={moduleContext.centralHqLocationId}
              canManage={moduleContext.canManage}
              onEdit={openEdit}
              onDeactivate={handleDeactivate}
              onReactivate={handleReactivate}
            />
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">No operational locations</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Create your first location or complete onboarding to seed the home site.
              </p>
              {moduleContext.canManage && canAdd && (
                <Button className="mt-4" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Create location
                </Button>
              )}
            </div>
          )}
        </section>
      </div>

      <LocationDrawerForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        rows={initialRows}
        governance={moduleContext.governance}
        editingLocation={editingLocation}
        onSaved={(locationId) => setSelectedId(locationId)}
      />

      {isPending && <span className="sr-only">Updating location…</span>}
    </>
  );
}
