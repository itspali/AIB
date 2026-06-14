import {
  RIGHT_DRAWER_FULL_WIDTH_VW,
  RIGHT_DRAWER_PRESET_WIDTHS,
  type RightDrawerLayoutValue,
} from "@/components/ui/right-drawer";

export type DocumentPeekActivityLayoutMode = "stack" | "rail" | "split";

export function resolveDocumentPeekActivityLayoutMode(
  layout: RightDrawerLayoutValue | null,
  isMobile: boolean
): DocumentPeekActivityLayoutMode {
  if (isMobile) {
    return "stack";
  }

  const widthVw = layout?.widthVw ?? RIGHT_DRAWER_PRESET_WIDTHS[0];
  const isFullWidth = layout != null && widthVw >= RIGHT_DRAWER_FULL_WIDTH_VW - 0.5;

  if (isFullWidth || widthVw >= RIGHT_DRAWER_PRESET_WIDTHS[2] - 0.5) {
    return "split";
  }

  if (layout?.isPartialDrawer !== false && widthVw >= RIGHT_DRAWER_PRESET_WIDTHS[1] - 0.5) {
    return "rail";
  }

  return "stack";
}
