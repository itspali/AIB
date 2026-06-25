import type { ImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings-shared";
import type { ModuleNavChild, ModuleNavItem } from "@/components/layout/module-nav";
import type { NavigationIndexEntry } from "@/lib/search/types";

/** Routes and nav entries gated behind tenant import logistics capability. */
export const IMPORT_LOGISTICS_NAV_PATHS = new Set([
  "/procurement/shipments",
  "/procurement/goods-in-transit",
]);

export function isImportLogisticsEnabled(
  settings: Pick<ImportLogisticsSettings, "imports_enabled"> | null | undefined
): boolean {
  return settings?.imports_enabled === true;
}

export function filterModuleNavItems(
  items: ModuleNavItem[],
  importsEnabled: boolean
): ModuleNavItem[] {
  if (importsEnabled) return items;

  return items.map((item) => {
    if (!item.children?.length) return item;
    const children = item.children.filter(
      (child) => !isImportOnlyNavChild(child)
    );
    return children.length === item.children.length ? item : { ...item, children };
  });
}

function isImportOnlyNavChild(child: ModuleNavChild): boolean {
  return child.importOnly === true || IMPORT_LOGISTICS_NAV_PATHS.has(child.href);
}

export function filterNavigationIndex(
  entries: NavigationIndexEntry[],
  importsEnabled: boolean
): NavigationIndexEntry[] {
  if (importsEnabled) return entries;
  return entries.filter(
    (entry) => !entry.importOnly && !IMPORT_LOGISTICS_NAV_PATHS.has(entry.href)
  );
}
