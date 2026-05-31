"use client";

import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  Package,
  Settings2,
  ShoppingCart,
  Truck,
} from "lucide-react";

export type ModuleNavChild = {
  href: string;
  label: string;
  /** Section is planned but not yet built; links to a "coming soon" view. */
  comingSoon?: boolean;
};

export type ModuleNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Module is planned but not yet built; lands on a "coming soon" page. */
  comingSoon?: boolean;
  /** Surface as a primary tab in the mobile bottom navigation. */
  mobilePrimary?: boolean;
  children?: ModuleNavChild[];
};

export const moduleNavItems: ModuleNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: LayoutDashboard,
    mobilePrimary: true,
  },
  {
    href: "/procurement",
    label: "Procurement",
    shortLabel: "Procure",
    icon: ShoppingCart,
    comingSoon: true,
    mobilePrimary: true,
  },
  {
    href: "/inventory",
    label: "Inventory",
    shortLabel: "Inv",
    icon: Package,
    mobilePrimary: true,
    children: [
      { href: "/inventory", label: "Overview" },
      { href: "/inventory/items", label: "Items" },
      { href: "/inventory/categories", label: "Categories" },
      { href: "/inventory/locations", label: "Locations" },
      { href: "/inventory/uom", label: "Units of Measure" },
    ],
  },
  {
    href: "/sales",
    label: "Sales",
    shortLabel: "Sales",
    icon: CreditCard,
    comingSoon: true,
    mobilePrimary: true,
  },
  {
    href: "/logistics",
    label: "Logistics",
    shortLabel: "Ship",
    icon: Truck,
    comingSoon: true,
  },
  {
    href: "/financials",
    label: "Financials",
    shortLabel: "Finance",
    icon: Boxes,
    comingSoon: true,
    mobilePrimary: true,
  },
  {
    href: "/settings",
    label: "Administration",
    shortLabel: "Admin",
    icon: Settings2,
    children: [
      { href: "/settings", label: "Overview" },
      { href: "/settings/organization", label: "Organization" },
      { href: "/settings/tax", label: "Tax" },
      { href: "/settings/users", label: "Users & Roles", comingSoon: true },
      { href: "/settings/profile", label: "My Account" },
    ],
  },
];
