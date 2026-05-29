import type { FilterScope } from "@/lib/search/types";

export type ModuleViewDefinition = {
  scope: FilterScope;
  moduleName: string;
  label: string;
  supportsSavedViews: boolean;
};

/** Active list modules that support saved native filter views. */
export const MODULE_VIEW_REGISTRY: ModuleViewDefinition[] = [
  {
    scope: "items",
    moduleName: "items",
    label: "My Saved Views",
    supportsSavedViews: true,
  },
  {
    scope: "categories",
    moduleName: "categories",
    label: "My Saved Views",
    supportsSavedViews: true,
  },
  {
    scope: "locations",
    moduleName: "locations",
    label: "My Saved Views",
    supportsSavedViews: true,
  },
];

/** Reserved module names for future list surfaces (register when pages ship). */
export const FUTURE_SAVED_VIEW_MODULES = [
  "procurement",
  "sales",
  "logistics",
  "financials",
] as const;

export function getModuleViewDefinition(scope: FilterScope): ModuleViewDefinition | null {
  return MODULE_VIEW_REGISTRY.find((entry) => entry.scope === scope) ?? null;
}

export function isSavedViewsScope(scope: FilterScope): boolean {
  return getModuleViewDefinition(scope)?.supportsSavedViews === true;
}

export function assertRegisteredModuleName(moduleName: string): boolean {
  return MODULE_VIEW_REGISTRY.some((entry) => entry.moduleName === moduleName);
}

export function scopeFromModuleName(moduleName: string): FilterScope | null {
  return MODULE_VIEW_REGISTRY.find((entry) => entry.moduleName === moduleName)?.scope ?? null;
}

const ALL_VIEW_LABELS: Partial<Record<FilterScope, string>> = {
  items: "All items",
  categories: "All categories",
  locations: "All locations",
};

export function getAllViewLabel(scope: FilterScope): string {
  return ALL_VIEW_LABELS[scope] ?? "All";
}

/** Sentinel value for the toolbar view select when no saved view is active. */
export const MODULE_VIEW_ALL = "__all__" as const;
