import type { NavigationIndexEntry } from "@/lib/search/types";

export const GLOBAL_NAVIGATION_INDEX: NavigationIndexEntry[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    keywords: ["dashboard", "home", "overview", "command hub"],
  },
  {
    label: "Items",
    href: "/inventory/items",
    keywords: ["items", "products", "catalog", "sku", "master", "inventory"],
  },
  {
    label: "Categories",
    href: "/inventory/categories",
    keywords: ["categories", "taxonomy", "classification", "inventory"],
  },
  {
    label: "Inventory Locations",
    href: "/inventory/locations",
    keywords: ["inventory", "locations", "warehouses", "facilities"],
  },
  {
    label: "Location Topology",
    href: "/inventory/locations/topology",
    keywords: ["topology", "hierarchy", "locations tree"],
  },
  {
    label: "Procurement",
    href: "/procurement",
    keywords: ["procurement", "purchase", "suppliers"],
  },
  {
    label: "Sales",
    href: "/sales",
    keywords: ["sales", "orders", "customers"],
  },
  {
    label: "Financials",
    href: "/financials",
    keywords: ["financials", "finance", "accounting", "ledger"],
  },
  {
    label: "Profile Settings",
    href: "/settings/profile",
    keywords: ["profile", "settings", "account", "user"],
  },
  {
    label: "Organization Settings",
    href: "/settings/organization",
    keywords: ["organization", "company", "tenant", "workspace"],
  },
];

export function matchNavigationIndex(query: string): NavigationIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return GLOBAL_NAVIGATION_INDEX.slice(0, 6);

  return GLOBAL_NAVIGATION_INDEX.filter(
    (entry) =>
      entry.label.toLowerCase().includes(q) ||
      entry.keywords.some((keyword) => keyword.includes(q) || q.includes(keyword))
  );
}
