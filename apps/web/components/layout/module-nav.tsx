"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Bell,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  FileOutput,
  FolderTree,
  LayoutDashboard,
  LayoutTemplate,
  MapPin,
  Package,
  PackageCheck,
  Receipt,
  Ruler,
  ScrollText,
  Settings2,
  Shield,
  Ship,
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
      {
        href: "/procurement/goods-in-transit",
        label: "Goods in Transit",
        icon: Ship,
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
    children: [
      { href: "/settings/organization", label: "Organization", icon: Building2 },
      { href: "/settings/group", label: "Group", icon: Network },
      { href: "/settings/locations", label: "Locations", icon: MapPin },
      {
        href: "/settings/documents/templates",
        label: "Document templates",
        icon: FileOutput,
      },
      { href: "/settings/modules", label: "Module settings", icon: LayoutTemplate },
      { href: "/settings/notifications", label: "Notification templates", icon: Bell },
      { href: "/settings/uom", label: "Units of Measure", icon: Ruler },
      { href: "/settings/tax", label: "Tax", icon: Receipt },
      { href: "/settings/users", label: "Users & Roles", icon: Shield, comingSoon: true },
      { href: "/settings/profile", label: "My Account", icon: User },
    ],
  },
];
