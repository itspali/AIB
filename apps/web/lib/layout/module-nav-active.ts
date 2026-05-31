import { moduleNavItems, type ModuleNavChild, type ModuleNavItem } from "@/components/layout/module-nav";

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

/** The currently active top-level module for a path, if any. */
export function resolveActiveModule(pathname: string): ModuleNavItem | null {
  return moduleNavItems.find((item) => isModuleNavItemActive(item, pathname)) ?? null;
}

/**
 * A page is "shallow" when it is a module/section index (the module root or an
 * exact section route) rather than a deeper detail/editor route. The secondary
 * module navigation only renders on shallow pages so it never competes with the
 * full-page editor/detail chrome.
 */
export function isShallowModulePath(item: ModuleNavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  return (item.children ?? []).some((child) => child.href === pathname);
}

export type ModuleBreadcrumb = {
  module: ModuleNavItem;
  section: ModuleNavChild | null;
};

/** Module + active section trail for breadcrumbs. */
export function resolveModuleBreadcrumb(pathname: string): ModuleBreadcrumb | null {
  const module = resolveActiveModule(pathname);
  if (!module) return null;
  return {
    module,
    section: getActiveModuleNavChild(module, pathname),
  };
}
