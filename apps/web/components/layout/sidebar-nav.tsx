"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/procurement", label: "Procurement", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales", icon: CreditCard },
  { href: "/logistics", label: "Logistics", icon: Truck },
  { href: "/financials", label: "Financials", icon: Boxes },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { sidebarCollapsed } = useOnboardingContext();

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r bg-background transition-all duration-200 md:flex md:flex-col",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-normal transition-colors duration-200 hover:bg-accent",
              pathname === href && "bg-accent text-accent-foreground",
              sidebarCollapsed && "justify-center px-2"
            )}
            title={sidebarCollapsed ? label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>{label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
