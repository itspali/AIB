"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type CatalogSubNavTab = "items" | "categories";

type Props = {
  active: CatalogSubNavTab;
  className?: string;
};

export function CatalogSubNav({ active, className }: Props) {
  return (
    <nav
      className={cn("mt-3 flex gap-2 text-sm md:hidden", className)}
      aria-label="Inventory sub-navigation"
    >
      <Link
        href="/inventory/items"
        prefetch={false}
        className={cn(
          "rounded-md px-2.5 py-1 transition-colors duration-200",
          active === "items"
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        aria-current={active === "items" ? "page" : undefined}
      >
        Items
      </Link>
      <Link
        href="/inventory/categories"
        prefetch={false}
        className={cn(
          "rounded-md px-2.5 py-1 transition-colors duration-200",
          active === "categories"
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        aria-current={active === "categories" ? "page" : undefined}
      >
        Categories
      </Link>
    </nav>
  );
}
