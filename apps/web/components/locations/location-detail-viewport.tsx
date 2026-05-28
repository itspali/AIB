"use client";

import { Building2, Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  locationCapabilitySummary,
  resolveAxisMicroBadges,
  resolveLocationTagVariant,
  tagLabel,
} from "@/lib/locations/axis-labels";
import { locationSupportsInventoryOps } from "@/lib/locations/capabilities";
import type { LocationRow } from "@/lib/locations/types";
import { cn } from "@/lib/utils";

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
  const tagVariant = resolveLocationTagVariant(location);
  const axisBadges = resolveAxisMicroBadges(location);
  const PresenceIcon = location.presence_type === "VIRTUAL" ? Globe2 : Building2;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PresenceIcon
              className={cn(
                "h-5 w-5",
                location.presence_type === "VIRTUAL" ? "text-indigo-500" : "text-muted-foreground"
              )}
            />
            <h2 className="text-xl font-semibold">{location.name}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {location.code} · {locationCapabilitySummary(location)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {centralHqLocationId === location.id && <Badge variant="active">CENTRAL HQ</Badge>}
          <Badge variant={location.is_active ? "completed" : "locked"}>
            {location.is_active ? "ACTIVE" : "INACTIVE"}
          </Badge>
          <Badge variant={tagVariant}>{tagLabel(tagVariant)}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {axisBadges.map((badge) => (
          <span
            key={badge.key}
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
              badge.className
            )}
          >
            {badge.label}
          </span>
        ))}
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Operational capabilities</dt>
          <dd className="mt-1 space-y-1 text-sm">
            {location.is_administrative_office && <p>Business / HQ administrative office</p>}
            {location.is_commercial_storefront && (
              <p>
                Commercial storefront
                {location.pos_terminal_count > 0
                  ? ` · ${location.pos_terminal_count} active POS terminals`
                  : ""}
              </p>
            )}
            {location.is_stock_holding && <p>Stock-holding warehouse authority</p>}
            {location.is_manufacturing_floor && (
              <p>Manufacturing floor · WIP and production routing enabled</p>
            )}
            {!location.is_administrative_office &&
              !location.is_commercial_storefront &&
              !location.is_stock_holding &&
              !location.is_manufacturing_floor && <p>—</p>}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Address</dt>
          <dd className="mt-1 text-sm">
            {location.presence_type === "VIRTUAL" ? (
              "Virtual digital gateway — no physical mailing address"
            ) : (
              <>
                {location.address_line1}
                {location.address_line2 ? `, ${location.address_line2}` : ""}
                <br />
                {location.city}, {location.state} {location.zip_postal}
                <br />
                {location.country_code}
              </>
            )}
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
        <section className="surface-panel space-y-2 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Inventory Operations
          </h3>
          <p className="text-sm text-muted-foreground">
            Inventory counting, moving average cost grids, and shelf slot selectors are available for
            this stock-holding location.
          </p>
        </section>
      ) : (
        <section className="surface-panel space-y-2 border-red-500/20 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Inventory Operations
          </h3>
          <p className="text-sm text-muted-foreground">
            This location is non-stock holding. Inventory counting tools, MWAC grids, and shelf slot
            selectors are hidden.
          </p>
        </section>
      )}

      {location.is_manufacturing_floor && (
        <section className="surface-panel space-y-2 border-red-500/20 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Manufacturing WIP Center
          </h3>
          <p className="text-sm text-muted-foreground">
            Production routing, bill of materials execution, and raw-to-WIP sub-ledger calculations
            are scoped to this manufacturing floor node.
          </p>
        </section>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onEdit}>Edit facility node</Button>
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
