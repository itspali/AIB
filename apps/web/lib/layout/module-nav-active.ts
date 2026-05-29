import type { ModuleNavChild, ModuleNavItem } from "@/components/layout/module-nav";

function childMatchesPath(childHref: string, pathname: string): boolean {
  return pathname === childHref || pathname.startsWith(`${childHref}/`);
}

export function getActiveModuleNavChild(
  item: ModuleNavItem,
  pathname: string
): ModuleNavChild | null {
  if (!item.children?.length) return null;

  const matches = item.children.filter((child) => childMatchesPath(child.href, pathname));
  if (!matches.length) return null;

  return matches.reduce((best, current) =>
    current.href.length > best.href.length ? current : best
  );
}

export function isModuleNavChildActive(
  child: ModuleNavChild,
  pathname: string,
  parent: ModuleNavItem
): boolean {
  return getActiveModuleNavChild(parent, pathname)?.href === child.href;
}

export function isModuleNavItemActive(item: ModuleNavItem, pathname: string): boolean {
  if (item.children?.length) {
    return getActiveModuleNavChild(item, pathname) != null;
  }
  if (pathname === item.href) return true;
  if (item.href !== "/" && pathname.startsWith(`${item.href}/`)) return true;
  return false;
}

export function isModuleNavGroupExpanded(item: ModuleNavItem, pathname: string): boolean {
  if (!item.children?.length) return false;
  return isModuleNavItemActive(item, pathname);
}
