"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  FolderTree,
  LayoutDashboard,
  MapPin,
  Package,
  PackageCheck,
  Receipt,
  Ruler,
  ScrollText,
  Settings2,
  Shield,
  ShoppingCart,
  Truck,
  User,
  Users,
  Network,
} from "lucide-react";

export type ModuleNavChild = {
  href: string;
  label: string;
  icon: LucideIcon;
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
    mobilePrimary: true,
    children: [
      { href: "/procurement", label: "Overview", icon: LayoutDashboard },
      {
        href: "/procurement/purchase-orders",
        label: "Purchase Orders",
        icon: ClipboardList,
      },
      {
        href: "/procurement/goods-receipts",
        label: "Goods Receipts",
        icon: PackageCheck,
      },
      { href: "/procurement/suppliers", label: "Suppliers", icon: Building2, comingSoon: true },
      { href: "/procurement/bills", label: "Bills", icon: ScrollText, comingSoon: true },
    ],
  },
  {
    href: "/items",
    label: "Items",
    shortLabel: "Items",
    icon: Package,
    mobilePrimary: true,
    children: [
      { href: "/items", label: "Catalog", icon: Package },
      { href: "/items/categories", label: "Categories", icon: FolderTree },
    ],
  },
  {
    href: "/inventory",
    label: "Inventory",
    shortLabel: "Inv",
    icon: Boxes,
    children: [
      { href: "/inventory", label: "Overview", icon: LayoutDashboard },
      { href: "/inventory/stock", label: "Stock", icon: Package },
      { href: "/inventory/transfers", label: "Transfers", icon: ArrowLeftRight },
    ],
  },
  {
    href: "/sales",
    label: "Sales",
    shortLabel: "Sales",
    icon: CreditCard,
    mobilePrimary: true,
    children: [
      { href: "/sales/customers", label: "Customers", icon: Users, comingSoon: true },
      { href: "/sales/quotes", label: "Quotes", icon: FileText, comingSoon: true },
      { href: "/sales/orders", label: "Orders", icon: ClipboardList, comingSoon: true },
      { href: "/sales/invoices", label: "Invoices", icon: Receipt, comingSoon: true },
    ],
  },
  {
    href: "/fulfillment/shipping",
    label: "Fulfillment & Shipping",
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
      { href: "/settings/organization", label: "Organization", icon: Building2 },
      { href: "/settings/group", label: "Group", icon: Network },
      { href: "/settings/locations", label: "Locations", icon: MapPin },
      { href: "/settings/uom", label: "Units of Measure", icon: Ruler },
      { href: "/settings/tax", label: "Tax", icon: Receipt },
      { href: "/settings/users", label: "Users & Roles", icon: Shield, comingSoon: true },
      { href: "/settings/profile", label: "My Account", icon: User },
    ],
  },
];
