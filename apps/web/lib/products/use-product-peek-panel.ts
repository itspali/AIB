"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loadProductPeekSection } from "@/app/items/actions";
import {
  buildModuleHref,
  parseProductPeekPanel,
} from "@/lib/layout/module-drawer-url";
import type { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import { enrichProductDetailSnapshot, peekItemCacheKey } from "@/lib/products/detail-enrichment";
import {
  isPeekSectionLoaded,
  mergeProductPeekSection,
  peekPanelToSection,
  type ProductPeekPanelId,
} from "@/lib/products/peek-panels";
import type { ProductCatalogContext, ProductDetailSnapshot } from "@/lib/products/types";

type DrawerState = ReturnType<typeof useModuleDrawerUrl>;

type Options = {
  basePath: string;
  drawer: DrawerState;
  detail: ProductDetailSnapshot | null;
  setDetail: React.Dispatch<React.SetStateAction<ProductDetailSnapshot | null>>;
  detailCacheRef: React.MutableRefObject<Map<string, ProductDetailSnapshot>>;
  detailCacheKey: (itemId: string, variantId?: string | null) => string;
  catalogContext?: ProductCatalogContext | null;
};

export function useProductPeekPanel({
  basePath,
  drawer,
  detail,
  setDetail,
  detailCacheRef,
  detailCacheKey,
  catalogContext = null,
}: Options) {
  const searchParams = useSearchParams();
  const peekPanel = useMemo(() => {
    if (typeof window !== "undefined") {
      return parseProductPeekPanel(new URLSearchParams(window.location.search));
    }
    return parseProductPeekPanel(searchParams);
  }, [drawer.historyEpoch, searchParams]);

  const [peekPanelLoading, setPeekPanelLoading] = useState<ProductPeekPanelId | null>(null);
  const peekSectionInFlightRef = useRef(new Set<string>());
  const peekEnabled = drawer.isOpen && drawer.surface === "peek" && Boolean(drawer.recordId);

  const syncPeekPanelUrl = useCallback(
    (panel: ProductPeekPanelId) => {
      if (!drawer.recordId || drawer.surface !== "peek") return;
      const preserveParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : searchParams;
      const href = buildModuleHref(basePath, {
        recordId: drawer.recordId,
        variantId: drawer.variantId,
        preserveParams,
        panel,
      });
      drawer.replaceDrawerHref(href);
    },
    [basePath, drawer, searchParams]
  );

  const loadPeekPanelSection = useCallback(
    async (panel: ProductPeekPanelId) => {
      const section = peekPanelToSection(panel);
      if (!section || !drawer.recordId) return;

      if (detail?.id === drawer.recordId && isPeekSectionLoaded(detail, section)) {
        return;
      }

      const requestKey = `${drawer.recordId}:${section}`;
      if (peekSectionInFlightRef.current.has(requestKey)) return;
      peekSectionInFlightRef.current.add(requestKey);
      setPeekPanelLoading(panel);

      try {
        const result = await loadProductPeekSection(
          drawer.recordId,
          section,
          drawer.variantId
        );
        if ("error" in result) {
          toast.error(result.error ?? "Unable to load product section.");
          return;
        }

        setDetail((current) => {
          if (!current || current.id !== drawer.recordId) return current;
          let merged = mergeProductPeekSection(current, section, result.patch);
          if (section === "reach" && catalogContext) {
            merged = enrichProductDetailSnapshot(merged, catalogContext);
          }
          detailCacheRef.current.set(
            detailCacheKey(merged.id, merged.variant_id),
            merged
          );
          detailCacheRef.current.set(peekItemCacheKey(merged.id), merged);
          return merged;
        });
      } finally {
        peekSectionInFlightRef.current.delete(requestKey);
        setPeekPanelLoading(null);
      }
    },
    [catalogContext, detail, detailCacheKey, detailCacheRef, drawer.recordId, drawer.variantId, setDetail]
  );

  const onPeekPanelChange = useCallback(
    (panel: ProductPeekPanelId) => {
      syncPeekPanelUrl(panel);
      void loadPeekPanelSection(panel);
    },
    [loadPeekPanelSection, syncPeekPanelUrl]
  );

  useEffect(() => {
    if (!peekEnabled || !detail) return;
    if (detail.id !== drawer.recordId) return;
    if (peekPanel === "essentials") return;
    void loadPeekPanelSection(peekPanel);
  }, [detail, drawer.recordId, loadPeekPanelSection, peekEnabled, peekPanel]);

  return {
    peekPanel,
    peekPanelLoading: peekEnabled ? peekPanelLoading : null,
    onPeekPanelChange: peekEnabled ? onPeekPanelChange : undefined,
  };
}
