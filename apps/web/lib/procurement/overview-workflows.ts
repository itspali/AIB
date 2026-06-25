import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  FolderTree,
  PackageCheck,
  ScrollText,
  Ship,
  Truck,
} from "lucide-react";
import { SUPPLIERS_HREF } from "@/lib/entities/entity-navigation";
import { supplierCategoriesHref } from "@/lib/entity-categories/navigation";

export type ProcurementJourneyStep = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  importOnly?: boolean;
};

export type ProcurementBentoTile = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  tier: "hero" | "primary" | "utility";
  importOnly?: boolean;
};

/** End-to-end inbound flow — primary navigation rail. */
export const PROCUREMENT_JOURNEY: ProcurementJourneyStep[] = [
  {
    id: "po",
    label: "Purchase order",
    href: "/procurement/purchase-orders",
    icon: ClipboardList,
  },
  {
    id: "grn",
    label: "Goods receipt",
    href: "/procurement/goods-receipts",
    icon: PackageCheck,
  },
  {
    id: "git",
    label: "In transit",
    href: "/procurement/goods-in-transit",
    icon: Ship,
    importOnly: true,
  },
  {
    id: "bill",
    label: "Supplier bill",
    href: "/procurement/bills",
    icon: ScrollText,
  },
];

export const PROCUREMENT_BENTO_TILES: ProcurementBentoTile[] = [
  {
    id: "po",
    label: "Purchase Orders",
    href: "/procurement/purchase-orders",
    icon: ClipboardList,
    tier: "hero",
  },
  {
    id: "grn",
    label: "Goods Receipts",
    href: "/procurement/goods-receipts",
    icon: PackageCheck,
    tier: "primary",
  },
  {
    id: "bills",
    label: "Bills",
    href: "/procurement/bills",
    icon: ScrollText,
    tier: "primary",
  },
  {
    id: "suppliers",
    label: "Suppliers",
    href: SUPPLIERS_HREF,
    icon: Building2,
    tier: "utility",
  },
  {
    id: "categories",
    label: "Categories",
    href: supplierCategoriesHref(),
    icon: FolderTree,
    tier: "utility",
  },
  {
    id: "shipments",
    label: "Import Shipments",
    href: "/procurement/shipments",
    icon: Ship,
    tier: "utility",
    importOnly: true,
  },
  {
    id: "subcontract",
    label: "Subcontracting",
    href: "/procurement/subcontract",
    icon: Truck,
    tier: "utility",
  },
];

export function resolveProcurementJourney(importsEnabled: boolean): ProcurementJourneyStep[] {
  return importsEnabled
    ? PROCUREMENT_JOURNEY
    : PROCUREMENT_JOURNEY.filter((step) => !step.importOnly);
}

export function resolveProcurementBentoTiles(importsEnabled: boolean): ProcurementBentoTile[] {
  return importsEnabled
    ? PROCUREMENT_BENTO_TILES
    : PROCUREMENT_BENTO_TILES.filter((tile) => !tile.importOnly);
}
