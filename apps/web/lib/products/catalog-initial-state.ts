import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateFilterAst } from "@/lib/search/executor/validate-ast";
import { executeItemsFilterRpc, normalizeItemsAst } from "@/lib/search/executor/supabase-items";
import { resolveSearchFieldPermissionsFromSession } from "@/lib/search/permissions/resolve-permissions-server";
import { fetchDefaultCustomModuleView } from "@/lib/search/views/queries";
import {
  savedViewNeedsNativeFilter,
  type SavedViewSnapshot,
} from "@/lib/search/views/saved-view-utils";
import type { CustomModuleView } from "@/lib/search/types";
import {
  resolveProductFieldPermissions,
} from "@/lib/products/field-permissions-server";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { fetchProductListByIds, fetchProductListPage } from "@/lib/products/list-queries";
import type { ProductListRow } from "@/lib/products/types";
import type { UserRole } from "@/lib/user/types";

export type ProductCatalogInitialState = {
  products: ProductListRow[];
  totalCount: number;
  hasMore: boolean;
  initialSavedView: SavedViewSnapshot | null;
  initialFilteredItemIds: string[] | null;
  fieldPermissions: ProductFieldPermissions;
};

function toSavedViewSnapshot(view: CustomModuleView): SavedViewSnapshot {
  return {
    id: view.id,
    module_name: view.module_name,
    view_name: view.view_name,
    raw_search_text: view.raw_search_text,
    compiled_ast: view.compiled_ast,
  };
}

export async function resolveProductCatalogInitialState(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  operatorRole: UserRole
): Promise<ProductCatalogInitialState> {
  const [fieldPermissions, searchPermissions, defaultView] = await Promise.all([
    resolveProductFieldPermissions(supabase, tenantId, operatorRole),
    resolveSearchFieldPermissionsFromSession(supabase, tenantId, userId, operatorRole),
    fetchDefaultCustomModuleView(supabase, tenantId, userId, "items"),
  ]);

  if (!defaultView) {
    const page = await fetchProductListPage(supabase, tenantId, fieldPermissions, {
      includeImages: false,
    });
    return {
      products: page.rows,
      totalCount: page.totalCount,
      hasMore: page.hasMore,
      initialSavedView: null,
      initialFilteredItemIds: null,
      fieldPermissions,
    };
  }

  const initialSavedView = toSavedViewSnapshot(defaultView);

  if (savedViewNeedsNativeFilter(defaultView.compiled_ast)) {
    const validation = validateFilterAst(defaultView.compiled_ast, "items", searchPermissions);
    if (validation.ok) {
      try {
        const normalizedAst = await normalizeItemsAst(supabase, tenantId, validation.ast);
        const itemIds = await executeItemsFilterRpc(supabase, tenantId, normalizedAst);
        const page = await fetchProductListByIds(supabase, tenantId, itemIds, fieldPermissions, {
          includeImages: false,
        });
        return {
          products: page.rows,
          totalCount: page.totalCount,
          hasMore: page.hasMore,
          initialSavedView,
          initialFilteredItemIds: itemIds,
          fieldPermissions,
        };
      } catch (error) {
        console.warn("[products] default view filter failed, falling back to full list:", error);
      }
    }
  }

  const page = await fetchProductListPage(supabase, tenantId, fieldPermissions, {
    includeImages: false,
  });
  return {
    products: page.rows,
    totalCount: page.totalCount,
    hasMore: page.hasMore,
    initialSavedView,
    initialFilteredItemIds: null,
    fieldPermissions,
  };
}
