"use client";



import { useEffect, useState } from "react";

import {
  isNarrowRightDrawer,
  RIGHT_DRAWER_PRESET_WIDTHS,
  useRightDrawerLayout,
  type RightDrawerLayoutValue,
} from "@/components/ui/right-drawer";

import { useDocumentLineTableFillHeight } from "@/lib/documents/use-document-line-table-fill-height";



/** Tailwind `md` — matches RightDrawer partial-panel breakpoint. */

const PO_PARTIAL_DRAWER_MEDIA = "(min-width: 768px)";



/** Tailwind `lg` — PO lines + summary rail sit side-by-side from here up. */

const PO_DRAWER_SIDE_RAIL_MEDIA = "(min-width: 1024px)";



/** Partial drawer below the 60vw preset — stacked layout, drawer body scrolls. */

export function isPoDrawerBelowWidePreset(

  isPartialDrawer: boolean,

  drawerWidthVw: number

): boolean {

  return (

    isPartialDrawer &&

    drawerWidthVw < RIGHT_DRAWER_PRESET_WIDTHS[1] - 0.5

  );

}



export function usePoDrawerFormLayout(

  isMutating: boolean,

  /** Passed from PoDrawerForm (outside RightDrawerLayoutProvider) when synced from inside the drawer. */

  layoutOverride?: RightDrawerLayoutValue | null

) {

  const contextLayout = useRightDrawerLayout();

  const drawerLayout = layoutOverride ?? contextLayout;

  const [isPartialDrawerViewport, setIsPartialDrawerViewport] = useState(false);

  const [isLargeViewport, setIsLargeViewport] = useState(false);



  useEffect(() => {

    const partialMedia = window.matchMedia(PO_PARTIAL_DRAWER_MEDIA);

    const lgMedia = window.matchMedia(PO_DRAWER_SIDE_RAIL_MEDIA);

    const sync = () => {

      setIsPartialDrawerViewport(partialMedia.matches);

      setIsLargeViewport(lgMedia.matches);

    };

    sync();

    partialMedia.addEventListener("change", sync);

    lgMedia.addEventListener("change", sync);

    return () => {

      partialMedia.removeEventListener("change", sync);

      lgMedia.removeEventListener("change", sync);

    };

  }, []);



  const isPartialDrawer =
    drawerLayout?.isPartialDrawer ?? isPartialDrawerViewport;
  const drawerWidthVw =
    drawerLayout?.widthVw ?? RIGHT_DRAWER_PRESET_WIDTHS[0];

  const stackVertically =

    isNarrowRightDrawer(drawerLayout) ||

    (drawerLayout == null &&

      isPartialDrawer &&

      drawerWidthVw <= RIGHT_DRAWER_PRESET_WIDTHS[0] + 0.5);

  const isBelowWidePreset = isPoDrawerBelowWidePreset(isPartialDrawer, drawerWidthVw);



  /** Partial drawer at 60vw+ on lg+: lines table and summary rail share a row. */

  const useWidePartialDrawer =

    isPartialDrawer &&

    !stackVertically &&

    isLargeViewport &&

    drawerWidthVw >= RIGHT_DRAWER_PRESET_WIDTHS[1] - 0.5;



  /** Full-viewport drawer (mobile / expanded): side rail from lg+, stacked below. */

  const useFullPageLayout = !isPartialDrawer;



  /**

   * md+ create/edit at 60vw/80vw (lg+ side-by-side): lines table fills remaining height.

   * Below 60vw partial drawer: body scroll; table grows with content.

   */

  const lineTableFillHeight = useDocumentLineTableFillHeight(

    isMutating &&

      !isBelowWidePreset &&

      (useWidePartialDrawer || (useFullPageLayout && isLargeViewport))

  );



  /** Drawer width below 60vw: body scroll; table grows with content. */

  const useDrawerBodyScroll = isMutating && isBelowWidePreset;



  return {

    stackVertically,

    isPartialDrawer,

    isBelowWidePreset,

    isLargeViewport,

    useWidePartialDrawer,

    useFullPageLayout,

    lineTableFillHeight,

    useDrawerBodyScroll,

  };

}


