"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LOCATION_LAYOUT_OVERRIDES_ENABLED,
  layoutScopeLabel,
  type DocumentLayoutScope,
  TENANT_LAYOUT_SCOPE,
} from "@/lib/documents/layout-scope";

export type DocumentLayoutLocationOption = {
  id: string;
  name: string;
};

type Props = {
  scope: DocumentLayoutScope;
  locations?: DocumentLayoutLocationOption[];
  disabled?: boolean;
  onScopeChange?: (scope: DocumentLayoutScope) => void;
};

export function DocumentLayoutScopeSelect({
  scope,
  locations = [],
  disabled = false,
  onScopeChange,
}: Props) {
  const selectDisabled = disabled || !LOCATION_LAYOUT_OVERRIDES_ENABLED || !onScopeChange;
  const value = scope.mode === "tenant" ? "tenant" : scope.locationId;
  const locationName =
    scope.mode === "location"
      ? locations.find((location) => location.id === scope.locationId)?.name
      : undefined;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="shrink-0 text-muted-foreground">Scope</span>
      <Select
        value={value}
        disabled={selectDisabled}
        onValueChange={(next) => {
          if (!onScopeChange) return;
          if (next === "tenant") {
            onScopeChange(TENANT_LAYOUT_SCOPE);
            return;
          }
          onScopeChange({ mode: "location", locationId: next });
        }}
      >
        <SelectTrigger className="h-7 w-[9.5rem] text-xs">
          <SelectValue>{layoutScopeLabel(scope, locationName)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tenant">All locations</SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!LOCATION_LAYOUT_OVERRIDES_ENABLED ? (
        <span className="text-[10px] text-muted-foreground">Per-location later</span>
      ) : null}
    </div>
  );
}
