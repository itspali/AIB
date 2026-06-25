"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavModuleLinkContent } from "@/components/layout/nav-link-content";
import { moduleNavItems } from "@/components/layout/module-nav";
import { filterModuleNavItems } from "@/lib/procurement/import-logistics-capability";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import { isModuleNavItemActive } from "@/lib/layout/module-nav-active";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MobileDrawerNavGroup } from "@/components/layout/module-nav-menu";

type MobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
};

export function MobileNavDrawer({ open, onOpenChange, orgName }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const { importsEnabled } = useOnboardingContext();
  const navItems = filterModuleNavItems(moduleNavItems, importsEnabled);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="glass-v2-app-mobile-drawer flex flex-col border p-0 backdrop-blur-xl">
        <SheetHeader className="border-b border-white/10 bg-gradient-to-r from-primary/10 to-transparent px-4 py-4 text-left">
          <SheetTitle className="truncate text-sm font-semibold">{orgName}</SheetTitle>
          <SheetDescription className="text-xs">Module navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile module navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            if (item.children?.length) {
              return (
                <MobileDrawerNavGroup
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => onOpenChange(false)}
                />
              );
            }

            const active = isModuleNavItemActive(item, pathname);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={() => onOpenChange(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "nav-glow-active bg-primary/10 text-primary"
                )}
              >
                <NavModuleLinkContent icon={Icon} label={item.label} />
                {item.comingSoon ? (
                  <span className="ml-auto rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Soon
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
