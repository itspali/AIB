export const MODULE_DRAWER_ID_PARAM = "id";
export const MODULE_DRAWER_VARIANT_PARAM = "variant";
export const MODULE_DRAWER_ACTION_PARAM = "action";

export const MODULE_DRAWER_ACTION_EDIT = "edit";
export const MODULE_DRAWER_ACTION_NEW = "new";

/** Legacy category params — canonicalized on read. */
export const LEGACY_CATEGORY_SELECTED_PARAM = "selected";
export const LEGACY_CATEGORY_CREATE_PARAM = "create";

/** Legacy items list param — canonicalized on read. */
export const LEGACY_ITEM_LIST_SELECTION_PARAM = "item";

export type ModuleDrawerAction = typeof MODULE_DRAWER_ACTION_EDIT | typeof MODULE_DRAWER_ACTION_NEW;

export type DrawerSurface = "closed" | "peek" | "edit" | "create";

export type ModuleDrawerState = {
  recordId: string | null;
  /** When set, item peek/edit focuses this variant row (items module). */
  variantId: string | null;
  action: ModuleDrawerAction | null;
  surface: DrawerSurface;
  /** True when URL used a legacy alias that should be replaced with canonical params. */
  needsCanonicalize: boolean;
};

export type PreservedQueryParams = {
  forEach(callbackfn: (value: string, key: string) => void): void;
};

export type BuildModuleHrefOptions = {
  recordId?: string | null;
  variantId?: string | null;
  action?: ModuleDrawerAction | null;
  /** Extra query params preserved when navigating (e.g. omnibar filters). */
  preserveParams?: URLSearchParams | PreservedQueryParams;
};

type SearchParamsLike = Pick<URLSearchParams, "get">;

function readId(searchParams: SearchParamsLike): string | null {
  const id = searchParams.get(MODULE_DRAWER_ID_PARAM);
  if (id?.trim()) return id.trim();

  const legacyItem = searchParams.get(LEGACY_ITEM_LIST_SELECTION_PARAM);
  if (legacyItem?.trim()) return legacyItem.trim();

  const legacySelected = searchParams.get(LEGACY_CATEGORY_SELECTED_PARAM);
  if (legacySelected?.trim()) return legacySelected.trim();

  return null;
}

function readAction(searchParams: SearchParamsLike): {
  action: ModuleDrawerAction | null;
  needsCanonicalize: boolean;
} {
  const raw = searchParams.get(MODULE_DRAWER_ACTION_PARAM)?.trim().toLowerCase();
  if (raw === MODULE_DRAWER_ACTION_EDIT) {
    return { action: MODULE_DRAWER_ACTION_EDIT, needsCanonicalize: false };
  }
  if (raw === MODULE_DRAWER_ACTION_NEW) {
    return { action: MODULE_DRAWER_ACTION_NEW, needsCanonicalize: false };
  }

  if (searchParams.get(LEGACY_CATEGORY_CREATE_PARAM) === "1") {
    return { action: MODULE_DRAWER_ACTION_NEW, needsCanonicalize: true };
  }

  return { action: null, needsCanonicalize: false };
}

export function parseModuleDrawerState(searchParams: SearchParamsLike): ModuleDrawerState {
  const recordId = readId(searchParams);
  const { action, needsCanonicalize: actionLegacy } = readAction(searchParams);

  const idLegacy =
    Boolean(searchParams.get(LEGACY_ITEM_LIST_SELECTION_PARAM)?.trim()) ||
    Boolean(searchParams.get(LEGACY_CATEGORY_SELECTED_PARAM)?.trim());

  const needsCanonicalize = idLegacy || actionLegacy;

  let surface: DrawerSurface = "closed";
  if (action === MODULE_DRAWER_ACTION_NEW) {
    surface = "create";
  } else if (action === MODULE_DRAWER_ACTION_EDIT && recordId) {
    surface = "edit";
  } else if (recordId) {
    surface = "peek";
  } else if (action === MODULE_DRAWER_ACTION_EDIT) {
    surface = "closed";
  }

  const variantRaw = searchParams.get(MODULE_DRAWER_VARIANT_PARAM);
  const variantId = variantRaw?.trim() ? variantRaw.trim() : null;

  return {
    recordId,
    variantId,
    action,
    surface,
    needsCanonicalize,
  };
}

export function isMutationSurface(surface: DrawerSurface): boolean {
  return surface === "edit" || surface === "create";
}

export function isDrawerOpen(surface: DrawerSurface): boolean {
  return surface !== "closed";
}

export function buildModuleHref(
  basePath: string,
  options: BuildModuleHrefOptions = {}
): string {
  const params = new URLSearchParams();

  if (options.preserveParams) {
    options.preserveParams.forEach((value, key) => {
      if (
        key === MODULE_DRAWER_ID_PARAM ||
        key === MODULE_DRAWER_VARIANT_PARAM ||
        key === MODULE_DRAWER_ACTION_PARAM ||
        key === LEGACY_ITEM_LIST_SELECTION_PARAM ||
        key === LEGACY_CATEGORY_SELECTED_PARAM ||
        key === LEGACY_CATEGORY_CREATE_PARAM
      ) {
        return;
      }
      params.set(key, value);
    });
  }

  const recordId = options.recordId?.trim();
  if (recordId) {
    params.set(MODULE_DRAWER_ID_PARAM, recordId);
  }

  const variantId = options.variantId?.trim();
  if (variantId) {
    params.set(MODULE_DRAWER_VARIANT_PARAM, variantId);
  }

  if (options.action) {
    params.set(MODULE_DRAWER_ACTION_PARAM, options.action);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function moduleDrawerPeekHref(
  basePath: string,
  recordId: string,
  preserveParams?: URLSearchParams | PreservedQueryParams,
  variantId?: string | null
): string {
  return buildModuleHref(basePath, { recordId, variantId, preserveParams });
}

export function moduleDrawerEditHref(
  basePath: string,
  recordId: string,
  preserveParams?: URLSearchParams | PreservedQueryParams,
  variantId?: string | null
): string {
  return buildModuleHref(basePath, {
    recordId,
    variantId,
    action: MODULE_DRAWER_ACTION_EDIT,
    preserveParams,
  });
}

export function moduleDrawerCreateHref(
  basePath: string,
  preserveParams?: URLSearchParams | PreservedQueryParams
): string {
  return buildModuleHref(basePath, {
    action: MODULE_DRAWER_ACTION_NEW,
    preserveParams,
  });
}
