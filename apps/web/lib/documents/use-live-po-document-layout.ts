"use client";

import { useEffect, useRef, useState } from "react";
import { loadEffectivePoDocumentLayout } from "@/app/procurement/purchase-orders/actions";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  normalizePoLayoutTemplate,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";

type LayoutFetchResult = { layout: DocumentLayoutTemplate } | { error: string };

const layoutResultCache = new Map<string, DocumentLayoutTemplate>();
const layoutFetchInflight = new Map<string, Promise<LayoutFetchResult>>();

function fetchPoDocumentLayout(documentLocationId: string): Promise<LayoutFetchResult> {
  const cached = layoutResultCache.get(documentLocationId);
  if (cached) {
    return Promise.resolve({ layout: cached });
  }

  let pending = layoutFetchInflight.get(documentLocationId);
  if (!pending) {
    pending = loadEffectivePoDocumentLayout(documentLocationId)
      .then((result) => {
        if (!("error" in result)) {
          layoutResultCache.set(
            documentLocationId,
            normalizePoLayoutTemplate(result.layout)
          );
        }
        return result;
      })
      .finally(() => {
        layoutFetchInflight.delete(documentLocationId);
      });
    layoutFetchInflight.set(documentLocationId, pending);
  }

  return pending;
}

type Options = {
  /** Refetch saved layout from the server when this becomes true (e.g. drawer open). */
  refreshWhen?: boolean;
  /** PO destination location — resolves location override when set. */
  documentLocationId?: string | null;
};

/**
 * Keeps PO document layout in sync with saved settings without a full page reload.
 * SSR `initialLayout` is the tenant default; opening the drawer refetches only when a
 * destination location is known (location override). Tenant-default is never re-fetched.
 */
export function useLivePoDocumentLayout(
  initialLayout: DocumentLayoutTemplate = DEFAULT_PO_SCREEN_LAYOUT,
  options?: Options
): DocumentLayoutTemplate {
  const [layout, setLayout] = useState(() => normalizePoLayoutTemplate(initialLayout));
  const refreshWhen = options?.refreshWhen ?? false;
  const documentLocationId = options?.documentLocationId?.trim() || null;
  const fetchedLocationRef = useRef<string | null>(null);

  useEffect(() => {
    setLayout(normalizePoLayoutTemplate(initialLayout));
  }, [initialLayout]);

  useEffect(() => {
    if (!refreshWhen) {
      fetchedLocationRef.current = null;
      return;
    }

    if (!documentLocationId) return;

    if (fetchedLocationRef.current === documentLocationId) return;
    fetchedLocationRef.current = documentLocationId;

    let cancelled = false;
    void fetchPoDocumentLayout(documentLocationId).then((result) => {
      if (cancelled || "error" in result) return;
      setLayout(normalizePoLayoutTemplate(result.layout));
    });

    return () => {
      cancelled = true;
    };
  }, [documentLocationId, refreshWhen]);

  return layout;
}
