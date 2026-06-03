import type { NavigationIndexEntry } from "@/lib/search/types";

export const GLOBAL_NAVIGATION_INDEX: NavigationIndexEntry[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    keywords: ["dashboard", "home", "overview", "command hub"],
  },
  {
    label: "Inventory",
    href: "/inventory/items",
    keywords: ["inventory", "stock", "warehouse", "items"],
  },
  {
    label: "Items",
    href: "/inventory/items",
    keywords: ["items", "products", "catalog", "sku", "master", "inventory"],
  },
  {
    label: "Categories",
    href: "/inventory/categories",
    keywords: ["categories", "taxonomy", "classification", "inventory", "new category"],
  },
  {
    label: "Inventory Locations",
    href: "/settings/locations",
    keywords: ["inventory", "locations", "warehouses", "facilities"],
  },
  {
    label: "Location Topology",
    href: "/settings/locations/topology",
    keywords: ["topology", "hierarchy", "locations tree"],
  },
  {
    label: "Units of Measure",
    href: "/settings/uom",
    keywords: ["uom", "units", "measure", "measurement", "conversion", "factor", "inventory"],
  },
  {
    label: "Procurement",
    href: "/procurement/suppliers",
    keywords: ["procurement", "purchase", "suppliers"],
  },
  {
    label: "Suppliers",
    href: "/procurement/suppliers",
    keywords: ["suppliers", "vendors", "procurement"],
  },
  {
    label: "Purchase Orders",
    href: "/procurement/purchase-orders",
    keywords: ["purchase orders", "po", "procurement", "buying"],
  },
  {
    label: "Bills",
    href: "/procurement/bills",
    keywords: ["bills", "supplier invoices", "accounts payable", "procurement"],
  },
  {
    label: "Sales",
    href: "/sales/customers",
    keywords: ["sales", "orders", "customers"],
  },
  {
    label: "Customers",
    href: "/sales/customers",
    keywords: ["customers", "accounts", "crm", "sales"],
  },
  {
    label: "Quotes",
    href: "/sales/quotes",
    keywords: ["quotes", "quotations", "proposals", "sales"],
  },
  {
    label: "Sales Orders",
    href: "/sales/orders",
    keywords: ["sales orders", "orders", "order management", "sales"],
  },
  {
    label: "Sales Invoices",
    href: "/sales/invoices",
    keywords: ["invoices", "billing", "accounts receivable", "sales"],
  },
  {
    label: "Logistics",
    href: "/logistics",
    keywords: ["logistics", "shipments", "transfers", "delivery"],
  },
  {
    label: "Financials",
    href: "/financials",
    keywords: ["financials", "finance", "accounting", "ledger"],
  },
  {
    label: "Administration",
    href: "/settings/organization",
    keywords: ["administration", "admin", "settings", "configuration", "setup"],
  },
  {
    label: "Organization Settings",
    href: "/settings/organization",
    keywords: ["organization", "company", "tenant", "workspace"],
  },
  {
    label: "Tax Settings",
    href: "/settings/tax",
    keywords: ["tax", "gst", "vat", "tax rule", "tax code", "slab", "rate", "settings"],
  },
  {
    label: "Users & Roles",
    href: "/settings/users",
    keywords: ["users", "roles", "team", "members", "access", "rbac", "delegation"],
  },
  {
    label: "Profile Settings",
    href: "/settings/profile",
    keywords: ["profile", "settings", "account", "user", "my account"],
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
