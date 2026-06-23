import type { ListModuleLoadMode } from "@/lib/layout/list-module/drawer-search-params";
import { detailMatchesDrawerVariant, type ProductDetailSnapshot } from "@/lib/products/types";

/** SSR peek refresh / shared link — detail and first list page are seeded server-side. */
export function isDeepLinkPeekLanding(
  loadMode: ListModuleLoadMode,
  initialProductCount: number,
  initialDetail: ProductDetailSnapshot | null | undefined
): boolean {
  return (
    loadMode === "drawer-deep-link" ||
    (initialProductCount === 0 && initialDetail != null)
  );
}

/** Accept SSR peek snapshot when URL has no variant (multi-SKU item-level open). */
export function peekDetailMatchesSsrSeed(
  detail: ProductDetailSnapshot,
  recordId: string,
  drawerVariant: string | null | undefined,
  scope: "peek" | "full"
): boolean {
  if (detail.id !== recordId) return false;
  if (scope === "full") {
    return (
      detail.detail_scope === "full" &&
      detailMatchesDrawerVariant(detail, drawerVariant)
    );
  }
  const variant = drawerVariant?.trim() || null;
  if (!variant) {
    return detail.detail_scope === "peek";
  }
  return detailMatchesDrawerVariant(detail, variant);
}
