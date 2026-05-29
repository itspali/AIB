"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type CatalogSubNavTab = "products" | "categories";

type Props = {
  active: CatalogSubNavTab;
};

export function CatalogSubNav({ active }: Props) {
  return (
    <nav className="mt-3 flex gap-2 text-sm md:hidden" aria-label="Catalog sub-navigation">
      <Link
        href="/items"
        className={cn(
          "rounded-md px-2.5 py-1 transition-colors duration-200",
          active === "products"
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        aria-current={active === "products" ? "page" : undefined}
      >
        Products
      </Link>
      <Link
        href="/items/categories"
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
