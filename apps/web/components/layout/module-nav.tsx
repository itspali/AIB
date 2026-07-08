"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Boxes,
  Building2,
  ClipboardList,
  ClipboardCheck,
  CreditCard,
  FileText,
  FolderTree,
  LayoutDashboard,
  Package,
  PackageCheck,
  Receipt,
  ScrollText,
  Settings2,
  Ship,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { flattenSettingsNavChildren } from "@/lib/settings/navigation";

export type ModuleNavChild = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden unless tenant has import logistics enabled. */
  importOnly?: boolean;
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
    href: "/items",
    label: "Items",
    shortLabel: "Items",
    icon: Package,
    mobilePrimary: true,
    children: [
      { href: "/items", label: "Items", icon: Package },
      { href: "/items/categories", label: "Categories", icon: FolderTree },
    ],
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
      {
        href: "/procurement/shipments",
        label: "Import Shipments",
        icon: Ship,
        importOnly: true,
      },
      {
        href: "/procurement/quality-inspection",
        label: "Quality Inspection",
        icon: ClipboardCheck,
      },
      {
        href: "/procurement/goods-in-transit",
        label: "Goods in Transit",
        icon: Truck,
        importOnly: true,
      },
      {
        href: "/procurement/subcontract",
        label: "Subcontracting",
        icon: Truck,
      },
      { href: "/procurement/suppliers", label: "Suppliers", icon: Building2 },
      {
        href: "/procurement/suppliers/categories",
        label: "Supplier Categories",
        icon: FolderTree,
      },
      { href: "/procurement/bills", label: "Bills", icon: ScrollText },
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
      { href: "/sales", label: "Overview", icon: LayoutDashboard },
      { href: "/sales/customers", label: "Customers", icon: Users },
      {
        href: "/sales/customers/categories",
        label: "Customer Categories",
        icon: FolderTree,
      },
      { href: "/sales/quotes", label: "Quotes", icon: FileText },
      { href: "/sales/orders", label: "Orders", icon: ClipboardList },
      { href: "/sales/invoices", label: "Invoices", icon: Receipt },
      { href: "/sales/payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    href: "/fulfillment",
    label: "Fulfillment",
    shortLabel: "Fulfill",
    icon: Truck,
    children: [
      { href: "/fulfillment", label: "Overview", icon: LayoutDashboard },
      { href: "/fulfillment/shipping", label: "Shipments", icon: Truck },
    ],
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
    children: flattenSettingsNavChildren(),
  },
];
