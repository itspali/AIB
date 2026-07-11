import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateFilterAst } from "@/lib/search/executor/validate-ast";
import { executeItemsFilterRpc, normalizeItemsAst } from "@/lib/search/executor/supabase-items";
import { resolveSearchFieldPermissionsFromSession } from "@/lib/search/permissions/resolve-permissions-server";
import { resolveActiveCustomModuleView } from "@/lib/search/views/catalog-view-bootstrap";
import { fetchCustomModuleViewsForUser } from "@/lib/search/views/queries";
import {
  savedViewNeedsNativeFilter,
  toSavedViewSnapshot,
  type SavedViewSnapshot,
} from "@/lib/search/views/saved-view-utils";
import type { CustomModuleView } from "@/lib/search/types";
import {
  resolveProductFieldPermissions,
} from "@/lib/products/field-permissions-server";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import {
  fetchProductListByIds,
  fetchProductListPage,
} from "@/lib/products/list-queries";
import {
  coerceProductListPrefs,
  resolveProductListExpandVariants,
  shouldIncludeListImages,
} from "@/lib/products/list-prefs";
import type { ProductListRow } from "@/lib/products/types";
import type { UserRole } from "@/lib/user/types";
import type { ProductListPrefs } from "@/lib/products/list-prefs";

export type ProductCatalogInitialState = {
  products: ProductListRow[];
  totalCount: number;
  hasMore: boolean;
  initialSavedViews: CustomModuleView[];
  initialSavedView: SavedViewSnapshot | null;
  initialFilteredItemIds: string[] | null;
  fieldPermissions: ProductFieldPermissions;
};

export async function resolveProductCatalogInitialState(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  operatorRole: UserRole,
  listPrefs?: ProductListPrefs | null,
  options?: { activeViewIdFromCookie?: string | null }
): Promise<ProductCatalogInitialState> {
  const coercedPrefs = listPrefs ? coerceProductListPrefs(listPrefs) : null;
  const expandVariants = coercedPrefs
    ? resolveProductListExpandVariants(coercedPrefs.showVariants, coercedPrefs.viewMode)
    : false;
  const includeImages = shouldIncludeListImages(coercedPrefs);

  const [fieldPermissions, moduleViews] = await Promise.all([
    resolveProductFieldPermissions(supabase, tenantId, operatorRole),
    fetchCustomModuleViewsForUser(supabase, tenantId, userId, "items"),
  ]);

  const activeView = resolveActiveCustomModuleView(
    moduleViews,
    options?.activeViewIdFromCookie
  );

  if (!activeView) {
    const page = await fetchProductListPage(supabase, tenantId, fieldPermissions, {
      includeImages,
      expandVariants,
    });
    return {
      products: page.rows,
      totalCount: page.totalCount,
      hasMore: page.hasMore,
      initialSavedViews: moduleViews,
      initialSavedView: null,
      initialFilteredItemIds: null,
      fieldPermissions,
    };
  }

  const initialSavedView = toSavedViewSnapshot(activeView);

  if (savedViewNeedsNativeFilter(activeView.compiled_ast)) {
    const searchPermissions = await resolveSearchFieldPermissionsFromSession(
      supabase,
      tenantId,
      userId,
      operatorRole
    );
    const validation = validateFilterAst(activeView.compiled_ast, "items", searchPermissions);
    if (validation.ok) {
      try {
        const normalizedAst = await normalizeItemsAst(supabase, tenantId, validation.ast);
        const itemIds = await executeItemsFilterRpc(supabase, tenantId, normalizedAst);
        const page = await fetchProductListByIds(supabase, tenantId, itemIds, fieldPermissions, {
          includeImages,
          expandVariants,
        });
        return {
          products: page.rows,
          totalCount: page.totalCount,
          hasMore: page.hasMore,
          initialSavedViews: moduleViews,
          initialSavedView,
          initialFilteredItemIds: itemIds,
          fieldPermissions,
        };
      } catch (error) {
        console.warn("[products] active view filter failed, falling back to full list:", error);
      }
    }
  }

  const page = await fetchProductListPage(supabase, tenantId, fieldPermissions, {
    includeImages,
    expandVariants,
  });
  return {
    products: page.rows,
    totalCount: page.totalCount,
    hasMore: page.hasMore,
    initialSavedViews: moduleViews,
    initialSavedView,
    initialFilteredItemIds: null,
    fieldPermissions,
  };
}
