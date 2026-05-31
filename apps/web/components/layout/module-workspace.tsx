"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ModuleSubNav } from "@/components/layout/module-sub-nav";
import {
  getActiveModuleNavChild,
  isShallowModulePath,
  resolveActiveModule,
} from "@/lib/layout/module-nav-active";
import { cn } from "@/lib/utils";

/**
 * Wraps module page content with ERP-standard chrome: a breadcrumb row and a
 * responsive secondary navigation (left sub-rail on lg+, horizontal sub-tabs on
 * smaller screens). Detail/editor routes (non-shallow) render content only so
 * the frozen full-page editor layouts are untouched.
 */
export function ModuleWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const module = resolveActiveModule(pathname);
  const activeChild = module ? getActiveModuleNavChild(module, pathname) : null;
  const sections = module?.children ?? [];
  const showSubNav =
    !!module && sections.length > 1 && isShallowModulePath(module, pathname);

  const showBreadcrumb = !!module && (sections.length > 0 || !!activeChild);

  return (
    <>
      {showBreadcrumb ? (
        <nav
          aria-label="Breadcrumb"
          className="mb-3 hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"
        >
          <Link
            href={module!.href}
            className="rounded-sm transition-colors hover:text-foreground"
          >
            {module!.label}
          </Link>
          {activeChild && activeChild.href !== module!.href ? (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <Link
                href={activeChild.href}
                className="rounded-sm font-medium text-foreground transition-colors hover:text-foreground"
              >
                {activeChild.label}
              </Link>
            </>
          ) : null}
        </nav>
      ) : null}

      {showSubNav && module ? (
        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
          <ModuleSubNav module={module} activeHref={activeChild?.href ?? module.href} />
          <div className={cn("min-w-0")}>{children}</div>
        </div>
      ) : (
        children
      )}
    </>
  );
}
