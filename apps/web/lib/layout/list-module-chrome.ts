/** Shared viewport + chrome tokens for list-module pages (Items reference layout). */

/** Alias scope class — grouped with `.list-workspace-root` in globals.css. */
export const GLASS_V2_ROOT_CLASS = "glass-v2-root";

/** Glass V2 app chrome (dashboard shell, sidebar, top strip, mobile nav). */
export const GLASS_V2_APP_SHELL_ROOT = "glass-v2-app-shell";

/** Glass V2 module overview / command-center scope (live production path). */
export const OVERVIEW_GLASS_ROOT_CLASS = "overview-glass-root";

/** Glass v2 — list workspace shell (`glass-v2-root` + `list-workspace-root` + revamp glass + compact). */
export const LIST_WORKSPACE_GLASS_V2_ROOT =
  "glass-v2-root list-workspace-root list-module-revamp list-module-revamp--glass list-module-revamp--compact";

/** Glass v2 — thumbnail / avatar frame for list rows (product image, category icon, …). */
export const GLASS_V2_LIST_IMAGE = "glass-v2-list-image";
export const GLASS_V2_LIST_IMAGE_PLACEHOLDER = "glass-v2-list-image--placeholder";

export const LIST_MODULE_VIEWPORT_OFFSET = "-mt-1.5 md:-mt-2 lg:-mt-3";

export const LIST_MODULE_VIEWPORT_FALLBACK_HEIGHT =
  "h-[calc(100dvh-4rem-7rem)] max-h-[calc(100dvh-4rem-7rem)] md:h-[calc(100dvh-4rem-6.5rem)] md:max-h-[calc(100dvh-4rem-6.5rem)]";

export const LIST_MODULE_PAGE_CHROME =
  "z-20 shrink-0 overflow-visible bg-background -mx-3 px-3 pt-2 pb-1 md:-mx-4 md:px-4 md:pt-2.5 md:pb-1.5 lg:-mx-6 lg:px-6 lg:pt-3 lg:pb-2";

/** Items-master matrix registry shell (see `ItemsMatrixRegistry`). */
export const LIST_WORKSPACE_MATRIX_REGISTRY_CARD =
  "matrix-glass-card flex min-h-0 flex-1 flex-col overflow-hidden";

export const LIST_WORKSPACE_MATRIX_REGISTRY_BODY =
  "matrix-table-body flex min-h-0 flex-1 basis-0 flex-col overflow-hidden";
