"use client";

import { loadDocumentLineStockContexts } from "@/app/inventory/stock/actions";
import type { DocumentLineStockContext } from "@/lib/inventory/stock/line-stock-context";

export type LineStockContextPrefetchScope = "full" | "on_hand";

export type LineStockContextPrefetchOptions = {
  scope?: LineStockContextPrefetchScope;
};

const cache = new Map<string, DocumentLineStockContext>();
const inflight = new Map<string, Promise<void>>();
const pendingKeys = new Set<string>();
const listeners = new Set<() => void>();
let cacheVersion = 0;

function cacheKey(locationId: string, variantId: string): string {
  return `${locationId.trim()}:${variantId.trim()}`;
}

function notify(): void {
  cacheVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function getLineStockContextCacheVersion(): number {
  return cacheVersion;
}

export function subscribeLineStockContextCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCachedLineStockContext(
  locationId: string,
  variantId: string
): DocumentLineStockContext | null {
  const key = cacheKey(locationId, variantId);
  if (!key || key === ":") return null;
  return cache.get(key) ?? null;
}

export function isLineStockContextPending(
  locationId: string,
  variantId: string
): boolean {
  const key = cacheKey(locationId, variantId);
  if (!key || key === ":") return false;
  return pendingKeys.has(key);
}

export function buildLineStockContextSnapshot(
  locationId: string,
  variantIds: readonly string[]
): Record<string, DocumentLineStockContext> {
  const loc = locationId.trim();
  if (!loc) return {};

  const snapshot: Record<string, DocumentLineStockContext> = {};
  for (const variantId of variantIds) {
    const id = variantId.trim();
    if (!id) continue;
    const entry = cache.get(cacheKey(loc, id));
    if (entry) snapshot[id] = entry;
  }
  return snapshot;
}

function runBatchPrefetch(
  locationId: string,
  variantIds: string[],
  options: LineStockContextPrefetchOptions = {}
): void {
  const loc = locationId.trim();
  if (!loc) return;

  const scope = options.scope ?? "full";

  const missing = [
    ...new Set(
      variantIds
        .map((id) => id.trim())
        .filter((id) => id && !cache.has(cacheKey(loc, id)))
    ),
  ];
  if (missing.length === 0) return;

  const requestKey = `${scope}::${loc}::${missing.join("\u0000")}`;
  if (inflight.has(requestKey)) return;

  for (const variantId of missing) {
    pendingKeys.add(cacheKey(loc, variantId));
  }
  notify();

  const promise = loadDocumentLineStockContexts({
    location_id: loc,
    variant_ids: missing,
    scope,
  })
    .then((result) => {
      if ("error" in result) return;
      for (const [variantId, context] of Object.entries(result.contexts)) {
        cache.set(cacheKey(loc, variantId), context);
      }
      notify();
    })
    .finally(() => {
      for (const variantId of missing) {
        pendingKeys.delete(cacheKey(loc, variantId));
      }
      inflight.delete(requestKey);
      notify();
    });

  inflight.set(requestKey, promise);
}

/** Warm stock for one or more variants at a document location. */
export function prefetchLineStockContexts(
  locationId: string,
  variantIds: string | readonly string[],
  options?: LineStockContextPrefetchOptions
): void {
  const ids = typeof variantIds === "string" ? [variantIds] : variantIds;
  runBatchPrefetch(locationId, [...ids], options);
}
