import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCategoryRows } from "@/lib/categories/queries";
import type { CategoryRow } from "@/lib/categories/types";
import { resolveListModuleDrawerParams } from "@/lib/layout/list-module/drawer-search-params";
import { parseProductPeekPanel } from "@/lib/layout/module-drawer-url";
import { resolveProductCatalogInitialState } from "@/lib/products/catalog-initial-state";
import { fetchProductCatalogContext } from "@/lib/products/commerce-queries";
import { enrichProductDetailSnapshot } from "@/lib/products/detail-enrichment";
import { resolveProductFieldPermissions } from "@/lib/products/field-permissions-server";
import { loadUserProductListPrefs } from "@/lib/products/list-prefs-server";
import {
  mergeProductPeekSection,
  peekPanelToSection,
} from "@/lib/products/peek-panels";
import { fetchProductDetail, fetchProductPeekSection } from "@/lib/products/queries";
import type { ProductCatalogInitialState } from "@/lib/products/catalog-initial-state";
import type { ProductCatalogContext, ProductDetailSnapshot } from "@/lib/products/types";
import type { ProductPeekPanelId } from "@/lib/products/types";
import type { ProductListPrefs } from "@/lib/products/list-prefs";
import type { UserRole } from "@/lib/user/types";

export type ProductCatalogLoaderProps = {
  tenantId: string;
  initialProducts: ProductCatalogInitialState["products"];
  listTotalCount: number;
  listHasMore: boolean;
  initialSavedView: ProductCatalogInitialState["initialSavedView"];
  initialFilteredItemIds: ProductCatalogInitialState["initialFilteredItemIds"];
  fieldPermissions: ProductCatalogInitialState["fieldPermissions"];
  initialListPrefs: ProductListPrefs | null;
  initialCatalogContext: ProductCatalogContext;
  categories: CategoryRow[];
  initialDetail: ProductDetailSnapshot | null;
  initialPeekPanel: ProductPeekPanelId | null;
};

function drawerSearchParams(
  searchParams: Record<string, string | string[] | undefined> | undefined
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry != null) params.append(key, entry);
      }
    } else {
      params.set(key, value);
    }
  }
  return params;
}

async function resolveDeepLinkDetail(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  variantId: string | null,
  peekPanel: ProductPeekPanelId,
  catalogContext: ProductCatalogContext
): Promise<ProductDetailSnapshot | null> {
  const detail = await fetchProductDetail(supabase, tenantId, itemId, {
    variantId,
    scope: "peek",
  });
  if (!detail) return null;

  let enriched = enrichProductDetailSnapshot(detail, catalogContext);
  const section = peekPanelToSection(peekPanel);
  if (!section) return enriched;

  const patch = await fetchProductPeekSection(
    supabase,
    tenantId,
    itemId,
    section,
    variantId
  );
  if (!patch) return enriched;

  enriched = mergeProductPeekSection(enriched, section, patch);
  return enrichProductDetailSnapshot(enriched, catalogContext);
}

export async function resolveProductCatalogLoaderProps(input: {
  supabase: SupabaseClient;
  tenantId: string;
  userId: string;
  operatorRole: UserRole;
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<ProductCatalogLoaderProps> {
  const { supabase, tenantId, userId, operatorRole, searchParams } = input;
  const drawerParams = resolveListModuleDrawerParams(searchParams);
  const urlParams = drawerSearchParams(searchParams);
  const peekPanel = parseProductPeekPanel(urlParams);

  const [initialListPrefs, catalogContext, categories] = await Promise.all([
    loadUserProductListPrefs(supabase, userId, tenantId),
    fetchProductCatalogContext(supabase, tenantId),
    fetchCategoryRows(supabase, tenantId),
  ]);

  if (
    drawerParams.mode === "drawer-deep-link" &&
    drawerParams.drawer.recordId &&
    (drawerParams.drawer.surface === "peek" || drawerParams.drawer.surface === "edit")
  ) {
    const recordId = drawerParams.drawer.recordId;
    const variantId = drawerParams.drawer.variantId;
    const scope = drawerParams.drawer.surface === "edit" ? "full" : "peek";
    const [fieldPermissions, initialDetail] = await Promise.all([
      resolveProductFieldPermissions(supabase, tenantId, operatorRole),
      scope === "peek"
        ? resolveDeepLinkDetail(
            supabase,
            tenantId,
            recordId,
            variantId,
            peekPanel,
            catalogContext
          )
        : fetchProductDetail(supabase, tenantId, recordId, {
            variantId,
            scope: "full",
          }).then((detail) =>
            detail ? enrichProductDetailSnapshot(detail, catalogContext) : null
          ),
    ]);

    return {
      tenantId,
      initialProducts: [],
      listTotalCount: 0,
      listHasMore: false,
      initialSavedView: null,
      initialFilteredItemIds: null,
      fieldPermissions,
      initialListPrefs,
      initialCatalogContext: catalogContext,
      categories,
      initialDetail,
      initialPeekPanel: peekPanel,
    };
  }

  const catalogState = await resolveProductCatalogInitialState(
    supabase,
    tenantId,
    userId,
    operatorRole,
    initialListPrefs
  );

  return {
    tenantId,
    initialProducts: catalogState.products,
    listTotalCount: catalogState.totalCount,
    listHasMore: catalogState.hasMore,
    initialSavedView: catalogState.initialSavedView,
    initialFilteredItemIds: catalogState.initialFilteredItemIds,
    fieldPermissions: catalogState.fieldPermissions,
    initialListPrefs,
    initialCatalogContext: catalogContext,
    categories,
    initialDetail: null,
    initialPeekPanel: null,
  };
}
