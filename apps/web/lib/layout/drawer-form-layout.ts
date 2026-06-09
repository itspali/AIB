export type DrawerLayoutEstimateInput = {
  widthVw: number;
  isPartialDrawer: boolean;
};

/** Minimum content width (px) for one comfortable label + input column. */
export const DRAWER_FORM_MIN_COLUMN_PX = 220;

/** Cap field columns so labels and controls stay readable in drawer forms. */
export const DRAWER_FORM_MAX_COLUMNS = 4;

export const DRAWER_FORM_GRID_GAP_PX = 16;

export type DrawerFormColumnCount = 1 | 2 | 3 | 4;

/** Horizontal padding on the drawer body (`px-4 sm:px-6`). */
export function drawerBodyHorizontalPaddingPx(viewportWidth: number): number {
  return viewportWidth >= 640 ? 48 : 32;
}

/** Estimate drawer content width before a ResizeObserver measurement is available. */
export function estimateDrawerContentWidthPx(
  drawerLayout: DrawerLayoutEstimateInput | null
): number | undefined {
  if (typeof window === "undefined") return undefined;

  const viewportWidth = window.innerWidth;
  const horizontalPad = drawerBodyHorizontalPaddingPx(viewportWidth);

  if (!drawerLayout?.isPartialDrawer) {
    return Math.max(0, viewportWidth - horizontalPad);
  }

  return Math.max(0, viewportWidth * (drawerLayout.widthVw / 100) - horizontalPad);
}

/** Resolve how many field columns fit in the available drawer content width. */
export function resolveDrawerFormColumnCount(
  contentWidthPx: number | undefined
): DrawerFormColumnCount {
  if (contentWidthPx == null || contentWidthPx <= 0) return 1;

  const count = Math.floor(
    (contentWidthPx + DRAWER_FORM_GRID_GAP_PX) /
      (DRAWER_FORM_MIN_COLUMN_PX + DRAWER_FORM_GRID_GAP_PX)
  );

  return Math.min(
    DRAWER_FORM_MAX_COLUMNS,
    Math.max(1, count)
  ) as DrawerFormColumnCount;
}

export function drawerFormGridStyle(columnCount: DrawerFormColumnCount): {
  gridTemplateColumns: string;
} {
  return {
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
  };
}

export function drawerFormFieldSpanClass(
  columnCount: DrawerFormColumnCount,
  span: "full" | 1 | 2 = 1
): string {
  if (span === "full" || span >= columnCount) {
    return "col-span-full";
  }

  if (span === 2 && columnCount >= 2) {
    return "col-span-2";
  }

  return "";
}
