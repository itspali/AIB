"use client";

import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tags,
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
  {
    href: "/items",
    label: "Product Catalog",
    shortLabel: "Catalog",
    icon: Tags,
    children: [
      { href: "/items", label: "Products" },
      { href: "/items/categories", label: "Categories" },
    ],
  },
  { href: "/procurement", label: "Procurement", shortLabel: "Procure", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", shortLabel: "Stock", icon: Package },
  { href: "/sales", label: "Sales", shortLabel: "Sales", icon: CreditCard },
  { href: "/logistics", label: "Logistics", shortLabel: "Ship", icon: Truck },
  { href: "/financials", label: "Financials", shortLabel: "Finance", icon: Boxes },
];
