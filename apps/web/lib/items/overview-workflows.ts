import type { LucideIcon } from "lucide-react";
import { FolderTree, Package, Plus, Ruler } from "lucide-react";
import { ITEMS_HREF } from "@/lib/products/item-navigation";
import { SETTINGS_ROUTES } from "@/lib/settings/navigation";

export type ItemsJourneyStep = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Opens full catalog (classic list) instead of navigating away. */
  openCatalog?: boolean;
};

export type ItemsBentoTile = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  tier: "hero" | "primary" | "utility";
  /** Switches preview to classic catalog on the same route. */
  openCatalog?: boolean;
};

export const ITEMS_JOURNEY: ItemsJourneyStep[] = [
  {
    id: "create",
    label: "Create item",
    href: `${ITEMS_HREF}?action=new`,
    icon: Plus,
  },
  {
    id: "categories",
    label: "Categories",
    href: "/items/categories",
    icon: FolderTree,
  },
  {
    id: "catalog",
    label: "Browse catalog",
    href: ITEMS_HREF,
    icon: Package,
    openCatalog: true,
  },
];

export const ITEMS_BENTO_TILES: ItemsBentoTile[] = [
  {
    id: "catalog",
    label: "Catalog",
    href: ITEMS_HREF,
    icon: Package,
    tier: "hero",
    openCatalog: true,
  },
  {
    id: "create",
    label: "New item",
    href: `${ITEMS_HREF}?action=new`,
    icon: Plus,
    tier: "primary",
  },
  {
    id: "categories",
    label: "Categories",
    href: "/items/categories",
    icon: FolderTree,
    tier: "primary",
  },
  {
    id: "uom",
    label: "Units of measure",
    href: SETTINGS_ROUTES.catalogsUom,
    icon: Ruler,
    tier: "utility",
  },
];
