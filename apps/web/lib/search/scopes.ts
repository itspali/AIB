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
  customers: {
    id: "customers",
    label: "Customers",
    placeholder: "Filter customers natively (e.g., name Acme, active true)…",
  },
  suppliers: {
    id: "suppliers",
    label: "Suppliers",
    placeholder: "Filter suppliers natively (e.g., name vendor, active true)…",
  },
  settings: {
    id: "settings",
    label: "Settings",
    placeholder: "Find organization settings…",
  },
};

const ROUTE_SCOPE_RULES: { prefix: string; scope: FilterScope }[] = [
  { prefix: "/entities/customers", scope: "customers" },
  { prefix: "/entities/suppliers", scope: "suppliers" },
  { prefix: "/entities", scope: "all" },
  { prefix: "/sales/customers", scope: "customers" },
  { prefix: "/procurement/suppliers", scope: "suppliers" },
  { prefix: "/items/categories", scope: "categories" },
  { prefix: "/items", scope: "items" },
  { prefix: "/inventory/categories", scope: "categories" },
  { prefix: "/inventory/items", scope: "items" },
  { prefix: "/inventory/stock", scope: "all" },
  { prefix: "/settings/locations", scope: "locations" },
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

/** True when the current route is the active module page (not a stale in-flight action). */
export function pathnameMatchesScope(pathname: string, scope: FilterScope): boolean {
  if (scope === "all") return true;
  return resolveScopeFromPath(pathname) === scope;
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
