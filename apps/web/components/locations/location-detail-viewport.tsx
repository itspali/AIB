"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { locationSupportsInventoryOps } from "@/lib/locations/capabilities";
import type { LocationRow } from "@/lib/locations/types";
import { locationTypeLabel } from "@/lib/locations/topology";

type Props = {
  location: LocationRow;
  centralHqLocationId: string | null;
  canManage: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
};

export function LocationDetailViewport({
  location,
  centralHqLocationId,
  canManage,
  onEdit,
  onDeactivate,
  onReactivate,
}: Props) {
  const supportsInventory = locationSupportsInventoryOps(location);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{location.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {location.code} · {locationTypeLabel(location.location_type)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {centralHqLocationId === location.id && <Badge variant="active">CENTRAL HQ</Badge>}
          <Badge variant={location.is_active ? "completed" : "locked"}>
            {location.is_active ? "ACTIVE" : "INACTIVE"}
          </Badge>
          <Badge variant={supportsInventory ? "completed" : "administrative"}>
            {supportsInventory ? "STOCK HOLDING" : "NON-STOCK"}
          </Badge>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Address</dt>
          <dd className="mt-1 text-sm">
            {location.address_line1}
            {location.address_line2 ? `, ${location.address_line2}` : ""}
            <br />
            {location.city}, {location.state} {location.zip_postal}
            <br />
            {location.country_code}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Contact</dt>
          <dd className="mt-1 text-sm">
            {location.manager_name || "—"}
            <br />
            {location.contact_email || "—"}
            <br />
            {location.contact_phone || "—"}
          </dd>
        </div>
        {location.location_tax_identifier && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Tax identifier</dt>
            <dd className="mt-1 text-sm">{location.location_tax_identifier}</dd>
          </div>
        )}
      </dl>

      {supportsInventory ? (
        <section className="surface-panel space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Inventory Operations
          </h3>
          <p className="text-sm text-muted-foreground">
            Inventory counting, moving average cost grids, and shelf slot selectors are available for
            this stock-holding location.
          </p>
        </section>
      ) : (
        <section className="surface-panel space-y-2 border-red-500/20">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Inventory Operations
          </h3>
          <p className="text-sm text-muted-foreground">
            This location is non-stock holding. Inventory counting tools, MWAC grids, and shelf slot
            selectors are hidden.
          </p>
        </section>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onEdit}>Edit location</Button>
          {location.is_active ? (
            <Button variant="outline" onClick={onDeactivate}>
              Deactivate
            </Button>
          ) : (
            <Button variant="outline" onClick={onReactivate}>
              Reactivate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
