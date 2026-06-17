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
import { cn } from "@/lib/utils";

export type DocumentLayoutLocationOption = {
  id: string;
  name: string;
};

type Props = {
  scope: DocumentLayoutScope;
  locations?: DocumentLayoutLocationOption[];
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  triggerClassName?: string;
  onScopeChange?: (scope: DocumentLayoutScope) => void;
};

export function DocumentLayoutScopeSelect({
  scope,
  locations = [],
  disabled = false,
  compact = false,
  className,
  triggerClassName,
  onScopeChange,
}: Props) {
  const selectDisabled = disabled || !LOCATION_LAYOUT_OVERRIDES_ENABLED || !onScopeChange;
  const value = scope.mode === "tenant" ? "tenant" : scope.locationId;
  const locationName =
    scope.mode === "location"
      ? locations.find((location) => location.id === scope.locationId)?.name
      : undefined;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-x-1.5 text-xs",
        compact ? "flex-1" : "flex-wrap gap-y-1",
        className
      )}
    >
      {!compact ? <span className="shrink-0 text-muted-foreground">Scope</span> : null}
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
        <SelectTrigger
          className={cn(
            "h-7 text-xs",
            compact ? "min-w-0 w-full border-border/60 bg-background/80" : "w-[9.5rem]",
            triggerClassName
          )}
          aria-label="Layout scope"
        >
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
