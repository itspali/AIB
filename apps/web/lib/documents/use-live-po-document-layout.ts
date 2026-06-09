"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPurchaseOrderDocumentLayout } from "@/app/settings/modules/procurement/actions";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  normalizePoLayoutTemplate,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";

type Options = {
  /** Refetch saved layout from the server when this becomes true (e.g. drawer open). */
  refreshWhen?: boolean;
};

/**
 * Keeps PO document layout in sync with saved settings without a full page reload.
 * SSR `initialLayout` is the first paint; opening the drawer refetches the tenant template.
 */
export function useLivePoDocumentLayout(
  initialLayout: DocumentLayoutTemplate = DEFAULT_PO_SCREEN_LAYOUT,
  options?: Options
): DocumentLayoutTemplate {
  const [layout, setLayout] = useState(() => normalizePoLayoutTemplate(initialLayout));
  const refreshWhen = options?.refreshWhen ?? false;
  const inflightRef = useRef(false);

  useEffect(() => {
    setLayout(normalizePoLayoutTemplate(initialLayout));
  }, [initialLayout]);

  const refresh = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const result = await loadPurchaseOrderDocumentLayout({ viewContext: "SCREEN_GRID" });
      if ("error" in result) return;
      setLayout(normalizePoLayoutTemplate(result.layout));
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!refreshWhen) return;
    void refresh();
  }, [refresh, refreshWhen]);

  return layout;
}
