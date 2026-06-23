import {
  LEGACY_CATEGORY_CREATE_PARAM,
  LEGACY_CATEGORY_SELECTED_PARAM,
  LEGACY_ITEM_LIST_SELECTION_PARAM,
  MODULE_DRAWER_ACTION_PARAM,
  MODULE_DRAWER_ID_PARAM,
  MODULE_DRAWER_PANEL_PARAM,
  MODULE_DRAWER_VARIANT_PARAM,
  parseModuleDrawerState,
  type ModuleDrawerState,
} from "@/lib/layout/module-drawer-url";

export type ListModuleLoadMode = "list" | "drawer-deep-link";

export type ResolvedListModuleDrawerParams = {
  mode: ListModuleLoadMode;
  drawer: ModuleDrawerState;
};

/** Query params that only affect drawer/peek state — not list filters or saved views. */
export const DRAWER_ONLY_QUERY_PARAMS = new Set([
  MODULE_DRAWER_ID_PARAM,
  MODULE_DRAWER_VARIANT_PARAM,
  MODULE_DRAWER_ACTION_PARAM,
  MODULE_DRAWER_PANEL_PARAM,
  LEGACY_ITEM_LIST_SELECTION_PARAM,
  LEGACY_CATEGORY_SELECTED_PARAM,
  LEGACY_CATEGORY_CREATE_PARAM,
]);

function toSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
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

function hasNonDrawerQueryParams(params: URLSearchParams): boolean {
  for (const key of params.keys()) {
    if (!DRAWER_ONLY_QUERY_PARAMS.has(key)) return true;
  }
  return false;
}

/**
 * Resolve whether the request is a list-first load or a refresh/deep link that
 * should SSR the drawer record and skip the full list fetch.
 */
export function resolveListModuleDrawerParams(
  searchParams: Record<string, string | string[] | undefined> | undefined
): ResolvedListModuleDrawerParams {
  const params = toSearchParams(searchParams ?? {});
  const drawer = parseModuleDrawerState(params);

  const isDeepLink =
    Boolean(drawer.recordId) &&
    (drawer.surface === "peek" || drawer.surface === "edit") &&
    !hasNonDrawerQueryParams(params);

  return {
    mode: isDeepLink ? "drawer-deep-link" : "list",
    drawer,
  };
}
