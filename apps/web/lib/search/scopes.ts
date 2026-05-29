import type { FilterScope } from "@/lib/search/types";

export type ScopeDefinition = {
  id: FilterScope;
  label: string;
  placeholder: string;
};

export const SCOPE_DEFINITIONS: Record<FilterScope, ScopeDefinition> = {
  all: {
    id: "all",
    label: "All Modules",
    placeholder: "Search modules, settings, records…",
  },
  items: {
    id: "items",
    label: "Items",
    placeholder: "Filter items natively (e.g., purchase price > sales price)…",
  },
  locations: {
    id: "locations",
    label: "Locations",
    placeholder: "Filter locations natively (e.g., city Mumbai, type warehouse)…",
  },
  categories: {
    id: "categories",
    label: "Categories",
    placeholder: "Filter categories natively (e.g., name electronics)…",
  },
  settings: {
    id: "settings",
    label: "Settings",
    placeholder: "Find organization settings…",
  },
};

const ROUTE_SCOPE_RULES: { prefix: string; scope: FilterScope }[] = [
  { prefix: "/items/categories", scope: "categories" },
  { prefix: "/items", scope: "items" },
  { prefix: "/inventory/locations", scope: "locations" },
  { prefix: "/settings", scope: "settings" },
];

export function resolveScopeFromPath(pathname: string): FilterScope {
  const normalized = pathname.split("?")[0] ?? pathname;
  for (const rule of ROUTE_SCOPE_RULES) {
    if (normalized === rule.prefix || normalized.startsWith(`${rule.prefix}/`)) {
      return rule.scope;
    }
  }
  return "all";
}

export function getScopePlaceholder(scope: FilterScope): string {
  return SCOPE_DEFINITIONS[scope].placeholder;
}

export function getScopeLabel(scope: FilterScope): string {
  return SCOPE_DEFINITIONS[scope].label;
}

export function getScopeTriggerLabel(scope: FilterScope): string {
  return `Search & filter (${SCOPE_DEFINITIONS[scope].label})…`;
}
