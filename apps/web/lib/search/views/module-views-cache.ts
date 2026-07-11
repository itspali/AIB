import type { CustomModuleView } from "@/lib/search/types";

const moduleViewsCache = new Map<string, CustomModuleView[]>();

export function seedModuleViewsCache(moduleName: string, views: readonly CustomModuleView[]): void {
  moduleViewsCache.set(moduleName, [...views]);
}

export function getModuleViewsCache(moduleName: string): CustomModuleView[] | null {
  const cached = moduleViewsCache.get(moduleName);
  return cached ? [...cached] : null;
}

export function hasModuleViewsCache(moduleName: string): boolean {
  return moduleViewsCache.has(moduleName);
}

export function invalidateModuleViewsCache(moduleName: string): void {
  moduleViewsCache.delete(moduleName);
}

export function clearModuleViewsCache(): void {
  moduleViewsCache.clear();
}
