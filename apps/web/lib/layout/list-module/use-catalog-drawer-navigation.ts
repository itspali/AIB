"use client";

import { applyModuleDrawerHistory } from "@/lib/layout/module-drawer-url";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Navigate back to a list module with drawer query params.
 * Uses pushState when already on the list route; otherwise router.push so Phase B
 * deep-link SSR can hydrate the drawer in one pass.
 */
export function useCatalogDrawerNavigation(listHref: string) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string, method: "push" | "replace" = "push") => {
      const listPath = listHref.split("?")[0] ?? listHref;
      const targetPath = href.split("?")[0] ?? href;

      if (pathname === listPath && targetPath === listPath) {
        applyModuleDrawerHistory(href, method);
        return;
      }

      startTransition(() => {
        if (method === "replace") {
          router.replace(href);
        } else {
          router.push(href);
        }
      });
    },
    [listHref, pathname, router]
  );

  return { navigate, isPending };
}
