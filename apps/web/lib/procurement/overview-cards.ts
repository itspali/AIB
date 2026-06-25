import {
  Building2,
  ClipboardList,
  FolderTree,
  PackageCheck,
  ScrollText,
  Ship,
  Truck,
} from "lucide-react";
import type { ModuleOverviewCard } from "@/components/layout/module-overview";
import { SUPPLIERS_HREF } from "@/lib/entities/entity-navigation";
import { supplierCategoriesHref } from "@/lib/entity-categories/navigation";

export const IMPORT_ONLY_PROCUREMENT_CARD_HREFS = new Set([
  "/procurement/shipments",
  "/procurement/goods-in-transit",
]);

export const PROCUREMENT_OVERVIEW_CARDS: ModuleOverviewCard[] = [
  {
    href: "/procurement/purchase-orders",
    label: "Purchase Orders",
    description: "Create draft POs, issue to suppliers, and track fulfillment status.",
    icon: ClipboardList,
  },
  {
    href: "/procurement/goods-receipts",
    label: "Goods Receipts",
    description: "Post GRNs against purchase orders or receive stock directly at a location.",
    icon: PackageCheck,
  },
  {
    href: "/procurement/goods-in-transit",
    label: "Goods in Transit",
    description: "Move stock to GIT holding nodes and clear them when import receipts land.",
    icon: Ship,
  },
  {
    href: "/procurement/shipments",
    label: "Import Shipments",
    description: "Consolidate overseas inbound logistics across purchase orders.",
    icon: Ship,
  },
  {
    href: "/procurement/subcontract",
    label: "Subcontracting",
    description: "Vendor job work locations and BOM backflush for finished goods receipts.",
    icon: Truck,
  },
  {
    href: SUPPLIERS_HREF,
    label: "Suppliers",
    description: "Vendor master profiles, contacts, and purchasing terms.",
    icon: Building2,
  },
  {
    href: supplierCategoriesHref(),
    label: "Supplier Categories",
    description: "Hierarchical supplier taxonomy and inherited attribute templates.",
    icon: FolderTree,
  },
  {
    href: "/procurement/bills",
    label: "Bills",
    description: "Supplier invoices, three-way match, and accounts payable posting.",
    icon: ScrollText,
  },
];

export function resolveProcurementOverviewCards(importsEnabled: boolean): ModuleOverviewCard[] {
  return importsEnabled
    ? PROCUREMENT_OVERVIEW_CARDS
    : PROCUREMENT_OVERVIEW_CARDS.filter((card) => !IMPORT_ONLY_PROCUREMENT_CARD_HREFS.has(card.href));
}
