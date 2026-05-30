"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import { moduleNavItems, type ModuleNavItem } from "@/components/layout/module-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  getActiveModuleNavChild,
  isModuleNavChildActive,
  isModuleNavGroupExpanded,
  isModuleNavItemActive,
} from "@/lib/layout/module-nav-active";
import { cn } from "@/lib/utils";

const navLinkClass =
  "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-normal transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const collapsedNavControlClass =
  "flex h-10 w-full items-center justify-center rounded-lg px-2 transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function sidebarWidthClass(collapsed: boolean): string {
  return collapsed ? "w-16" : "w-64";
}

export function SidebarHeaderToggleColumn({
  branding,
  onOpenMobileNav,
}: {
  branding?: React.ReactNode;
  onOpenMobileNav?: () => void;
}) {
  const { sidebarCollapsed, setSidebarCollapsed } = useOnboardingContext();

  return (
    <div
      className={cn(
        "flex h-16 w-16 shrink-0 items-center gap-1 border-r border-white/10 bg-card/40 p-2 transition-all duration-200",
        sidebarCollapsed ? "md:justify-center" : "md:min-w-0",
        sidebarCollapsed ? "md:w-16" : "md:w-64"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="flex h-10 w-full items-center justify-center rounded-lg px-2 transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open module navigation"
      >
        <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "hidden h-10 items-center justify-center rounded-lg transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex",
          sidebarCollapsed ? "w-full px-2" : "shrink-0 px-3"
        )}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!sidebarCollapsed}
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden />
        )}
      </Button>
      {!sidebarCollapsed && branding ? (
        <div className="hidden min-w-0 flex-1 overflow-hidden md:block">{branding}</div>
      ) : null}
    </div>
  );
}

const childLinkClass =
  "flex items-center rounded-md py-2 pl-9 pr-3 text-sm transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function SidebarNavGroup({
  item,
  pathname,
  collapsed,
}: {
  item: ModuleNavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const groupActive = isModuleNavItemActive(item, pathname);
  const defaultExpanded = isModuleNavGroupExpanded(item, pathname);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const Icon = item.icon;
  const children = item.children ?? [];

  useEffect(() => {
    if (defaultExpanded) setExpanded(true);
  }, [defaultExpanded]);

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              collapsedNavControlClass,
              groupActive && "nav-glow-active bg-primary/10 text-primary"
            )}
            title={item.label}
            aria-label={item.label}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                groupActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-hidden
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-48">
          <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
          {children.map((child) => {
            const childActive = isModuleNavChildActive(child, pathname, item);
            return (
              <DropdownMenuItem key={child.href} asChild>
                <Link
                  href={child.href}
                  prefetch={false}
                  className={cn(childActive && "bg-primary/10 text-primary font-medium")}
                >
                  {child.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const activeChild = getActiveModuleNavChild(item, pathname);

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          "flex items-center rounded-lg",
          groupActive && "bg-primary/5"
        )}
      >
        <Link
          href={activeChild?.href ?? children[0]?.href ?? item.href}
          prefetch={false}
          aria-current={groupActive && !expanded ? "page" : undefined}
          className={cn(
            navLinkClass,
            "min-w-0 flex-1",
            groupActive && "text-primary"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors duration-200",
              groupActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}
            aria-hidden
          />
          <span className="truncate">{item.label}</span>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mr-1 h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${item.label} menu` : `Expand ${item.label} menu`}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>

      {expanded ? (
        <div className="flex flex-col gap-0.5" role="group" aria-label={`${item.label} views`}>
          {children.map((child) => {
            const childActive = isModuleNavChildActive(child, pathname, item);
            return (
              <Link
                key={child.href}
                href={child.href}
                prefetch={false}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  childLinkClass,
                  childActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SidebarNavLink({
  item,
  pathname,
  collapsed,
}: {
  item: ModuleNavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isModuleNavItemActive(item, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        navLinkClass,
        active && "nav-glow-active bg-primary/10 text-primary",
        collapsed && "justify-center px-2 h-10 py-0"
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors duration-200",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
        aria-hidden
      />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const { sidebarCollapsed } = useOnboardingContext();

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-white/10 bg-card/40 backdrop-blur-xl transition-all duration-200 md:flex",
        sidebarWidthClass(sidebarCollapsed)
      )}
    >
      <nav aria-label="Module navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 pt-3">
        {moduleNavItems.map((item) =>
          item.children?.length ? (
            <SidebarNavGroup
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={sidebarCollapsed}
            />
          ) : (
            <SidebarNavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={sidebarCollapsed}
            />
          )
        )}
      </nav>
    </aside>
  );
}
