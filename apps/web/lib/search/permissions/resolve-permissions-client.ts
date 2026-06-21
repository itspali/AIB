"use client";

import { resolveSearchFieldPermissions } from "@/app/search/actions";
import type { SearchFieldPermissions } from "@/lib/search/types";

const inflight = new Map<string, Promise<SearchFieldPermissions>>();

/** Collapse concurrent permission reads (e.g. React Strict Mode double mount). */
export function resolveSearchFieldPermissionsDeduped(
  userId: string,
  tenantId: string
): Promise<SearchFieldPermissions> {
  const key = `${tenantId}:${userId}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const request = resolveSearchFieldPermissions().finally(() => {
    if (inflight.get(key) === request) {
      inflight.delete(key);
    }
  });
  inflight.set(key, request);
  return request;
}
