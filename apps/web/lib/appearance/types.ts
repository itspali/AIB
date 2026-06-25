export type UiGeneration = "classic" | "preview" | "matrix";

export type UiVisualStyle = "glass" | "flat";

export type UiDensity = "compact" | "comfortable";

/** Catalog list page header — stacked title row + toolbar vs single unified row. */
export type UiHeaderChrome = "stacked" | "unified";

export type AppearancePreviewState = {
  generation: UiGeneration;
  visual: UiVisualStyle;
  density: UiDensity;
  headerChrome: UiHeaderChrome;
};

export const DEFAULT_APPEARANCE_PREVIEW: AppearancePreviewState = {
  generation: "classic",
  visual: "glass",
  density: "compact",
  headerChrome: "unified",
};
