/** Fixed partial-drawer widths (vw). Mobile always uses full viewport. */

export const DRAWER_WIDTH_PEEK_VW = 42;
export const DRAWER_WIDTH_MUTATE_VW = 60;
export const DRAWER_WIDTH_DOCUMENT_VW = 60;

/** Matrix-layout catalog peek drawer (Items matrix view). */
export const MATRIX_PEEK_DRAWER_WIDTH_VW = 60;

/** @deprecated Use {@link DRAWER_WIDTH_PEEK_VW} — kept for layout helpers that referenced 40vw peek. */
export const DRAWER_WIDTH_LEGACY_PEEK_VW = 40;

export type DrawerWidthPolicy = "peek" | "mutate" | "document";

export function resolveDrawerWidthVw(policy: DrawerWidthPolicy): number {
  switch (policy) {
    case "peek":
      return DRAWER_WIDTH_PEEK_VW;
    case "mutate":
      return DRAWER_WIDTH_MUTATE_VW;
    case "document":
      return DRAWER_WIDTH_DOCUMENT_VW;
  }
}

/** Pop-out window dimensions when opening a drawer form outside the panel. */
export const DRAWER_POPOUT_WINDOW_FEATURES =
  "noopener,noreferrer,width=1280,height=900,menubar=no,toolbar=no,location=yes,status=no";

export type DrawerPopOutTarget = "tab" | "window";

export function openDrawerPopOut(href: string, target: DrawerPopOutTarget = "tab"): void {
  if (typeof window === "undefined") return;
  if (target === "window") {
    window.open(href, "aib-drawer-popout", DRAWER_POPOUT_WINDOW_FEATURES);
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}
