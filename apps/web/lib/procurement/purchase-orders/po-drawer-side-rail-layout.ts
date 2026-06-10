import {
  RIGHT_DRAWER_FULL_WIDTH_VW,
  RIGHT_DRAWER_PRESET_WIDTHS,
} from "@/components/ui/right-drawer";

/** Tailwind `md` — partial drawer panel from here up. */
export const PO_PARTIAL_DRAWER_MEDIA = "(min-width: 768px)";

/** Tailwind `lg` — minimum viewport for 60vw side-by-side rail. */
export const PO_SIDE_RAIL_LG_MEDIA = "(min-width: 1024px)";

/** Drawer side rail — compact for 60vw partial panel. */
export const PO_DRAWER_SIDE_RAIL_CLASS =
  "w-full md:w-[15rem] md:min-w-[15rem] md:max-w-[40%]";

/** 80vw partial drawer — slightly wider rail. */
export const PO_DRAWER_WIDE_SIDE_RAIL_CLASS =
  "w-full md:w-[18rem] md:min-w-[18rem] md:max-w-[38%]";

/** Full-page side rail — room for summary labels and money values. */
export const PO_FULL_PAGE_SIDE_RAIL_CLASS =
  "w-full md:w-[22rem] md:min-w-[22rem] md:max-w-[min(26rem,34%)]";

export function isPoDrawerBelowWidePreset(
  isPartialDrawer: boolean,
  drawerWidthVw: number
): boolean {
  return (
    isPartialDrawer &&
    drawerWidthVw < RIGHT_DRAWER_PRESET_WIDTHS[1] - 0.5
  );
}

export function isPoDrawerAtLeastWidePreset(drawerWidthVw: number): boolean {
  return drawerWidthVw >= RIGHT_DRAWER_PRESET_WIDTHS[1] - 0.5;
}

export function isPoDrawerAtLeastExtraWidePreset(drawerWidthVw: number): boolean {
  return drawerWidthVw >= RIGHT_DRAWER_PRESET_WIDTHS[2] - 0.5;
}

/** Side rail fits at the current viewport for this drawer width. */
export function canShowPoSideRailAtViewport(
  drawerWidthVw: number,
  isPartialDrawer: boolean,
  isMdViewport: boolean,
  isLgViewport: boolean
): boolean {
  if (!isMdViewport) return false;

  const isFullWidth = !isPartialDrawer || drawerWidthVw >= RIGHT_DRAWER_FULL_WIDTH_VW - 0.5;
  if (isFullWidth) return true;

  if (isPoDrawerAtLeastExtraWidePreset(drawerWidthVw)) return true;
  if (isPoDrawerAtLeastWidePreset(drawerWidthVw) && isLgViewport) return true;

  return false;
}

/** md for 80vw+ and full-page; lg for 60vw partial. */
export function resolvePoSideRailBreakpoint(
  drawerWidthVw: number,
  useFullPageLayout: boolean
): "md" | "lg" {
  if (useFullPageLayout || isPoDrawerAtLeastExtraWidePreset(drawerWidthVw)) {
    return "md";
  }
  return "lg";
}

export function resolvePoSideRailWidthClass(
  useFullPageLayout: boolean,
  drawerWidthVw: number
): string {
  if (useFullPageLayout) return PO_FULL_PAGE_SIDE_RAIL_CLASS;
  if (isPoDrawerAtLeastExtraWidePreset(drawerWidthVw)) {
    return PO_DRAWER_WIDE_SIDE_RAIL_CLASS;
  }
  return PO_DRAWER_SIDE_RAIL_CLASS;
}

type PoSideRailBreakpointSlot =
  | "desktopShow"
  | "mobileHide"
  | "flexRow"
  | "sideRailHeight";

export function poSideRailBreakpointClass(
  drawerWidthVw: number,
  useFullPageLayout: boolean,
  slot: PoSideRailBreakpointSlot
): string {
  const bp = resolvePoSideRailBreakpoint(drawerWidthVw, useFullPageLayout);

  switch (slot) {
    case "desktopShow":
      return bp === "md" ? "hidden md:flex" : "hidden lg:flex";
    case "mobileHide":
      return bp === "md" ? "md:hidden" : "lg:hidden";
    case "flexRow":
      return bp === "md" ? "md:flex-row md:items-stretch" : "lg:flex-row lg:items-stretch";
    case "sideRailHeight":
      return bp === "md" ? "md:h-full md:w-auto" : "lg:h-full lg:w-auto";
    default:
      return "";
  }
}
