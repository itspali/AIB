"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { moduleNavItems } from "@/components/layout/module-nav";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col border-white/10 bg-card/95 p-0 backdrop-blur-xl">
        <SheetHeader className="border-b border-white/10 bg-gradient-to-r from-primary/10 to-transparent px-4 py-4 text-left">
          <SheetTitle className="truncate text-sm font-semibold">{orgName}</SheetTitle>
          <SheetDescription className="text-xs">Module navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile module navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {moduleNavItems.map((item) => {
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
                onClick={() => onOpenChange(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "nav-glow-active bg-primary/10 text-primary"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
