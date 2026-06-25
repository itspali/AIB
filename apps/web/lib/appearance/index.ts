export type {
  AppearancePreviewState,
  UiDensity,
  UiGeneration,
  UiVisualStyle,
} from "@/lib/appearance/types";
export { DEFAULT_APPEARANCE_PREVIEW } from "@/lib/appearance/types";
export {
  APPEARANCE_PREVIEW_STORAGE_KEY,
  parseAppearancePreviewState,
  persistAppearancePreviewState,
  readAppearancePreviewState,
} from "@/lib/appearance/storage";
