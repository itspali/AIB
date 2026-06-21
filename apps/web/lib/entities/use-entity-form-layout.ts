"use client";

import {
  RIGHT_DRAWER_PRESET_WIDTHS,
  useRightDrawerLayout,
} from "@/components/ui/right-drawer";

/** Two-panel create layout when the drawer is wide enough (60vw+ partial, or full expand). */
export function useEntityFormTwoPanelLayout(): boolean {
  const layout = useRightDrawerLayout();
  if (!layout) return false;

  if (!layout.isPartialDrawer) {
    return false;
  }

  return layout.widthVw >= RIGHT_DRAWER_PRESET_WIDTHS[1] - 0.5;
}
