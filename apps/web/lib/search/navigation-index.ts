import type { NavigationIndexEntry } from "@/lib/search/types";

export const GLOBAL_NAVIGATION_INDEX: NavigationIndexEntry[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    keywords: ["dashboard", "home", "overview", "command hub"],
  },
  {
    label: "Items",
    href: "/items",
    keywords: ["items", "products", "catalog", "sku", "master", "product master"],
  },
  {
    label: "Categories",
    href: "/items/categories",
    keywords: ["categories", "taxonomy", "classification", "items", "new category"],
  },
  {
    label: "Inventory",
    href: "/inventory",
    keywords: ["inventory", "stock", "warehouse", "on hand", "transfers"],
  },
  {
    label: "Stock",
    href: "/inventory/stock",
    keywords: ["stock", "on hand", "quantity", "inventory", "warehouse"],
  },
  {
    label: "Transfers",
    href: "/inventory/transfers",
    keywords: ["transfers", "stock transfer", "inter-location", "inventory"],
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
    href: "/procurement",
    keywords: ["procurement", "purchase", "suppliers", "grn", "goods receipt"],
  },
  {
    label: "Purchase Orders",
    href: "/procurement/purchase-orders",
    keywords: ["purchase orders", "po", "procurement", "buying"],
  },
  {
    label: "Goods Receipts",
    href: "/procurement/goods-receipts",
    keywords: ["goods receipts", "grn", "receipt", "inbound", "procurement"],
  },
  {
    label: "Suppliers",
    href: "/procurement/suppliers",
    keywords: ["suppliers", "vendors", "procurement"],
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
    label: "Fulfillment & Shipping",
    href: "/fulfillment/shipping",
    keywords: ["fulfillment", "shipping", "shipments", "delivery", "carrier"],
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
    label: "Group Settings",
    href: "/settings/group",
    keywords: ["group", "enterprise", "holding", "subsidiary", "multi-org"],
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
