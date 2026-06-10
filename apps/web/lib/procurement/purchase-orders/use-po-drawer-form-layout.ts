"use client";

import { useEffect, useState } from "react";
import {
  isFullWidthRightDrawer,
  isNarrowRightDrawer,
  RIGHT_DRAWER_PRESET_WIDTHS,
  useRightDrawerLayout,
  type RightDrawerLayoutValue,
} from "@/components/ui/right-drawer";
import { useDocumentLineTableFillHeight } from "@/lib/documents/use-document-line-table-fill-height";
import {
  canShowPoSideRailAtViewport,
  isPoDrawerBelowWidePreset,
  PO_PARTIAL_DRAWER_MEDIA,
  PO_SIDE_RAIL_LG_MEDIA,
} from "@/lib/procurement/purchase-orders/po-drawer-side-rail-layout";

export { isPoDrawerBelowWidePreset } from "@/lib/procurement/purchase-orders/po-drawer-side-rail-layout";

export function usePoDrawerFormLayout(
  isMutating: boolean,
  layoutOverride?: RightDrawerLayoutValue | null
) {
  const contextLayout = useRightDrawerLayout();
  const drawerLayout = layoutOverride ?? contextLayout;
  const [isMdViewport, setIsMdViewport] = useState(false);
  const [isLgViewport, setIsLgViewport] = useState(false);

  useEffect(() => {
    const mdMedia = window.matchMedia(PO_PARTIAL_DRAWER_MEDIA);
    const lgMedia = window.matchMedia(PO_SIDE_RAIL_LG_MEDIA);
    const sync = () => {
      setIsMdViewport(mdMedia.matches);
      setIsLgViewport(lgMedia.matches);
    };
    sync();
    mdMedia.addEventListener("change", sync);
    lgMedia.addEventListener("change", sync);
    return () => {
      mdMedia.removeEventListener("change", sync);
      lgMedia.removeEventListener("change", sync);
    };
  }, []);

  const isPartialDrawer = drawerLayout?.isPartialDrawer ?? isMdViewport;
  const drawerWidthVw = drawerLayout?.widthVw ?? RIGHT_DRAWER_PRESET_WIDTHS[0];

  const stackVertically =
    isNarrowRightDrawer(drawerLayout) ||
    (drawerLayout == null &&
      isPartialDrawer &&
      drawerWidthVw <= RIGHT_DRAWER_PRESET_WIDTHS[0] + 0.5);

  const isBelowWidePreset = isPoDrawerBelowWidePreset(isPartialDrawer, drawerWidthVw);

  const effectiveDrawerLayout: RightDrawerLayoutValue = drawerLayout ?? {
    widthVw: drawerWidthVw,
    isPartialDrawer,
  };
  const isFullWidthDrawer = isFullWidthRightDrawer(effectiveDrawerLayout);
  const useFullPageLayout = !isPartialDrawer || isFullWidthDrawer;

  const isSideRailViewport = canShowPoSideRailAtViewport(
    drawerWidthVw,
    isPartialDrawer,
    isMdViewport,
    isLgViewport
  );

  const useWidePartialDrawer =
    isPartialDrawer &&
    !isFullWidthDrawer &&
    !stackVertically &&
    isSideRailViewport &&
    drawerWidthVw >= RIGHT_DRAWER_PRESET_WIDTHS[1] - 0.5;

  const useDesktopSideRail =
    isMutating &&
    !isBelowWidePreset &&
    isSideRailViewport &&
    (useWidePartialDrawer || useFullPageLayout);

  const lineTableFillHeight = useDocumentLineTableFillHeight(useDesktopSideRail);

  const useMobileDocumentStack =
    isMutating &&
    !isBelowWidePreset &&
    !useDesktopSideRail &&
    (useFullPageLayout || drawerWidthVw >= RIGHT_DRAWER_PRESET_WIDTHS[1] - 0.5);

  const useDrawerBodyScroll = isMutating && isBelowWidePreset;

  return {
    stackVertically,
    isPartialDrawer,
    drawerWidthVw,
    isBelowWidePreset,
    isMdViewport,
    isLgViewport,
    isSideRailViewport,
    useWidePartialDrawer,
    useFullPageLayout,
    useDesktopSideRail,
    useMobileDocumentStack,
    lineTableFillHeight,
    useDrawerBodyScroll,
  };
}
