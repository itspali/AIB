"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import {
  NavModuleLinkContent,
  NavTextLinkContent,
  navIconSlotClass,
} from "@/components/layout/nav-link-content";
import { moduleNavItems, type ModuleNavItem } from "@/components/layout/module-nav";
import { filterModuleNavItems } from "@/lib/procurement/import-logistics-capability";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  isModuleNavChildActive,
  isModuleNavGroupExpanded,
  isModuleNavItemActive,
} from "@/lib/layout/module-nav-active";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH_EXPANDED = "w-52";
const SIDEBAR_WIDTH_COLLAPSED = "w-16";

const navLinkClass =
  "group flex h-10 items-center justify-start gap-2.5 rounded-lg px-2.5 text-sm font-normal transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function sidebarWidthClass(collapsed: boolean): string {
  return collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
}

const childLinkClass =
  "flex shrink-0 items-center gap-2 rounded-md py-2 pl-8 pr-2.5 text-sm transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
    setExpanded(defaultExpanded);
  }, [pathname, defaultExpanded]);

  const groupTrigger = (
    <Button
      type="button"
      variant="ghost"
      aria-expanded={collapsed ? undefined : expanded}
      aria-label={
        collapsed
          ? item.label
          : expanded
            ? `Collapse ${item.label} menu`
            : `Expand ${item.label} menu`
      }
      title={collapsed ? item.label : undefined}
      onClick={collapsed ? undefined : () => setExpanded((value) => !value)}
      className={cn(
        navLinkClass,
        "w-full",
        groupActive && "nav-glow-active bg-primary/10 text-primary"
      )}
    >
      <NavModuleLinkContent
        icon={Icon}
        label={<span className="truncate">{item.label}</span>}
        showLabel={!collapsed}
        iconClassName={cn(
          "transition-colors duration-200",
          groupActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {!collapsed ? (
        expanded ? (
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )
      ) : null}
    </Button>
  );

  if (collapsed) {
    return (
      <div className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{groupTrigger}</DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-48">
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            {children.map((child) => {
              const childActive = isModuleNavChildActive(child, pathname, item);
              return (
                <DropdownMenuItem key={child.href} asChild>
                  <Link
                    href={child.href}
                    prefetch
                    className={cn(
                      "flex cursor-pointer items-center gap-2",
                      childActive && "bg-primary/10 font-medium text-primary"
                    )}
                  >
                    <NavTextLinkContent
                      icon={child.icon}
                      iconClassName={childActive ? "text-primary" : undefined}
                    >
                      {child.label}
                    </NavTextLinkContent>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <div
        className={cn(
          "flex items-center rounded-lg",
          groupActive && "bg-primary/5"
        )}
      >
        {groupTrigger}
      </div>

      {expanded ? (
        <div className="flex flex-col gap-0.5" role="group" aria-label={`${item.label} views`}>
          {children.map((child) => {
            const childActive = isModuleNavChildActive(child, pathname, item);
            return (
              <Link
                key={child.href}
                href={child.href}
                prefetch
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  childLinkClass,
                  childActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <NavTextLinkContent
                  icon={child.icon}
                  iconClassName={
                    childActive ? "text-primary" : undefined
                  }
                >
                  {child.label}
                </NavTextLinkContent>
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
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        navLinkClass,
        "shrink-0",
        active && "nav-glow-active bg-primary/10 text-primary"
      )}
      title={collapsed ? item.label : undefined}
    >
      <NavModuleLinkContent
        icon={Icon}
        label={item.label}
        showLabel={!collapsed}
        iconClassName={cn(
          "transition-colors duration-200",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed, importsEnabled } = useOnboardingContext();
  const navItems = filterModuleNavItems(moduleNavItems, importsEnabled);

  return (
    <aside
      className={cn(
        "glass-v2-app-sidebar hidden h-full shrink-0 flex-col overflow-x-hidden border-r backdrop-blur-xl transition-[width] duration-200 ease-in-out md:flex",
        sidebarWidthClass(sidebarCollapsed)
      )}
    >
      <nav
        aria-label="Module navigation"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 pt-3"
      >
        {navItems.map((item) =>
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
      <div className="shrink-0 border-t border-white/10 p-2">
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "Expand sidebar" : undefined}
          className={cn(navLinkClass, "w-full text-muted-foreground hover:text-foreground")}
        >
          <span className={navIconSlotClass}>
            {sidebarCollapsed ? (
              <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" aria-hidden />
            )}
          </span>
          <span
            aria-hidden={sidebarCollapsed}
            className={cn(
              "truncate transition-[opacity,width] duration-200 ease-in-out",
              sidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
            )}
          >
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
}
