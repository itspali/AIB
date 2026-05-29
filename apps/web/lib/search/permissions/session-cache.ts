import type { SearchFieldPermissions } from "@/lib/search/types";

const cache = new Map<string, SearchFieldPermissions>();

function cacheKey(userId: string, tenantId: string): string {
  return `${tenantId}:${userId}`;
}

export function getCachedSearchPermissions(
  userId: string,
  tenantId: string
): SearchFieldPermissions | null {
  return cache.get(cacheKey(userId, tenantId)) ?? null;
}

export function setCachedSearchPermissions(
  userId: string,
  tenantId: string,
  permissions: SearchFieldPermissions
): void {
  cache.set(cacheKey(userId, tenantId), permissions);
}

export function invalidateSearchPermissions(userId: string, tenantId: string): void {
  cache.delete(cacheKey(userId, tenantId));
}

export function setThrottledSearch(userId: string, tenantId: string, throttled: boolean): void {
  const key = cacheKey(userId, tenantId);
  const existing = cache.get(key);
  if (!existing) return;
  cache.set(key, { ...existing, throttled });
}
