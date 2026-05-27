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

export type ModuleNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

export const moduleNavItems: ModuleNavItem[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { href: "/procurement", label: "Procurement", shortLabel: "Procure", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", shortLabel: "Stock", icon: Package },
  { href: "/sales", label: "Sales", shortLabel: "Sales", icon: CreditCard },
  { href: "/logistics", label: "Logistics", shortLabel: "Ship", icon: Truck },
  { href: "/financials", label: "Financials", shortLabel: "Finance", icon: Boxes },
];
