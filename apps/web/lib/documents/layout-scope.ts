export type DocumentLayoutScope =
  | { mode: "tenant" }
  | { mode: "location"; locationId: string };

export const TENANT_LAYOUT_SCOPE: DocumentLayoutScope = { mode: "tenant" };

/** When true, location dropdown on document layout settings is editable. */
export const LOCATION_LAYOUT_OVERRIDES_ENABLED = false;

export function layoutScopeKey(scope: DocumentLayoutScope): string {
  return scope.mode === "tenant" ? "tenant" : scope.locationId;
}

export function layoutScopeLabel(scope: DocumentLayoutScope, locationName?: string): string {
  if (scope.mode === "tenant") return "All locations";
  return locationName?.trim() || "Location override";
}
