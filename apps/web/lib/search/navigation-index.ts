import type { NavigationIndexEntry } from "@/lib/search/types";
import { filterNavigationIndex } from "@/lib/procurement/import-logistics-capability";
import { buildSettingsNavigationIndex } from "@/lib/settings/navigation";

const SETTINGS_NAVIGATION_INDEX = buildSettingsNavigationIndex();

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
    label: "Sales Overview",
    href: "/sales",
    keywords: ["sales", "overview", "customers", "receivables"],
  },
  {
    label: "Customers",
    href: "/sales/customers",
    keywords: ["customers", "accounts", "crm", "sales", "partners"],
  },
  {
    label: "Customer Categories",
    href: "/sales/customers/categories",
    keywords: ["customer categories", "customer taxonomy", "partners", "sales"],
  },
  {
    label: "Suppliers",
    href: "/procurement/suppliers",
    keywords: ["suppliers", "vendors", "procurement", "partners"],
  },
  {
    label: "Supplier Categories",
    href: "/procurement/suppliers/categories",
    keywords: ["supplier categories", "vendor categories", "partners", "procurement"],
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
    href: "/settings/workspace/locations",
    keywords: ["inventory", "locations", "warehouses", "facilities"],
  },
  {
    label: "Location Topology",
    href: "/settings/workspace/locations/topology",
    keywords: ["topology", "hierarchy", "locations tree"],
  },
  {
    label: "Units of Measure",
    href: "/settings/catalogs/uom",
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
    label: "Import Shipments",
    href: "/procurement/shipments",
    keywords: ["import shipments", "shipment", "inbound", "logistics", "bill of lading", "boe", "procurement"],
    importOnly: true,
  },
  {
    label: "Goods in Transit",
    href: "/procurement/goods-in-transit",
    keywords: ["goods in transit", "git", "import", "in transit", "procurement"],
    importOnly: true,
  },
  {
    label: "Quality Inspection",
    href: "/procurement/quality-inspection",
    keywords: ["quality inspection", "qc", "inspection", "quarantine", "procurement"],
  },
  {
    label: "Suppliers",
    href: "/procurement/suppliers",
    keywords: ["suppliers", "vendors", "procurement"],
  },
  {
    label: "Supplier Categories",
    href: "/procurement/suppliers/categories",
    keywords: ["supplier categories", "vendor categories", "procurement"],
  },
  {
    label: "Bills",
    href: "/procurement/bills",
    keywords: ["bills", "supplier invoices", "accounts payable", "procurement"],
  },
  {
    label: "Sales",
    href: "/sales",
    keywords: ["sales", "orders", "customers", "overview"],
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
    label: "Customer Payments",
    href: "/sales/payments",
    keywords: ["payments", "receipts", "customer payments", "sales"],
  },
  {
    label: "Fulfillment",
    href: "/fulfillment",
    keywords: ["fulfillment", "logistics", "warehouse", "shipping", "pick pack"],
  },
  {
    label: "Shipments",
    href: "/fulfillment/shipping",
    keywords: ["shipments", "shipping", "delivery", "carrier", "dispatch", "fulfillment"],
  },
  {
    label: "Financials",
    href: "/financials",
    keywords: ["financials", "finance", "accounting", "ledger"],
  },
  ...SETTINGS_NAVIGATION_INDEX,
];

export function matchNavigationIndex(
  query: string,
  options?: { importsEnabled?: boolean }
): NavigationIndexEntry[] {
  const pool = filterNavigationIndex(
    GLOBAL_NAVIGATION_INDEX,
    options?.importsEnabled ?? false
  );
  const q = query.trim().toLowerCase();
  if (!q) return pool.slice(0, 6);

  return pool.filter(
    (entry) =>
      entry.label.toLowerCase().includes(q) ||
      entry.keywords.some((keyword) => keyword.includes(q) || q.includes(keyword))
  );
}
