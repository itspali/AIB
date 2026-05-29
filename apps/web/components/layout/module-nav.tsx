"use client";

import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";

export type ModuleNavChild = {
  href: string;
  label: string;
};

export type ModuleNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  children?: ModuleNavChild[];
};

export const moduleNavItems: ModuleNavItem[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { href: "/procurement", label: "Procurement", shortLabel: "Procure", icon: ShoppingCart },
  {
    href: "/inventory/items",
    label: "Inventory",
    shortLabel: "Inv",
    icon: Package,
    children: [
      { href: "/inventory/items", label: "Items" },
      { href: "/inventory/categories", label: "Categories" },
      { href: "/inventory/locations", label: "Locations" },
    ],
  },
  { href: "/sales", label: "Sales", shortLabel: "Sales", icon: CreditCard },
  { href: "/logistics", label: "Logistics", shortLabel: "Ship", icon: Truck },
  { href: "/financials", label: "Financials", shortLabel: "Finance", icon: Boxes },
];
