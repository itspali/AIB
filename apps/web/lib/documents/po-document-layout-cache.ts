import {
  DEFAULT_PO_SCREEN_LAYOUT,
  normalizePoLayoutTemplate,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";

const layoutResultCache = new Map<string, DocumentLayoutTemplate>();

export function getCachedPoDocumentLayout(
  documentLocationId: string
): DocumentLayoutTemplate | undefined {
  return layoutResultCache.get(documentLocationId);
}

export function setCachedPoDocumentLayout(
  documentLocationId: string,
  layout: DocumentLayoutTemplate
): void {
  layoutResultCache.set(documentLocationId, normalizePoLayoutTemplate(layout));
}

export function resolveLayoutForDocumentLocation(
  initialLayout: DocumentLayoutTemplate = DEFAULT_PO_SCREEN_LAYOUT,
  documentLocationId: string | null
): DocumentLayoutTemplate {
  if (documentLocationId) {
    const cached = layoutResultCache.get(documentLocationId);
    if (cached) {
      return normalizePoLayoutTemplate(cached);
    }
  }
  return normalizePoLayoutTemplate(initialLayout);
}

export function needsLocationLayoutFetch(
  refreshWhen: boolean,
  documentLocationId: string | null
): boolean {
  if (!refreshWhen || !documentLocationId) return false;
  return !layoutResultCache.has(documentLocationId);
}

/** @internal Test helper — clears the in-memory location layout cache. */
export function clearPoDocumentLayoutCacheForTests(): void {
  layoutResultCache.clear();
}

/** @internal Test helper — seeds the in-memory location layout cache. */
export function seedPoDocumentLayoutCacheForTests(
  documentLocationId: string,
  layout: DocumentLayoutTemplate
): void {
  setCachedPoDocumentLayout(documentLocationId, layout);
}
