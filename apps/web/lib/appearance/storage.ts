import {
  DEFAULT_APPEARANCE_PREVIEW,
  type AppearancePreviewState,
  type UiDensity,
  type UiGeneration,
  type UiHeaderChrome,
  type UiVisualStyle,
} from "@/lib/appearance/types";

export const APPEARANCE_PREVIEW_STORAGE_KEY = "aib-ui-preview";

function isUiGeneration(value: unknown): value is UiGeneration {
  return value === "classic" || value === "preview" || value === "matrix";
}

function isUiVisualStyle(value: unknown): value is UiVisualStyle {
  return value === "glass" || value === "flat";
}

function isUiDensity(value: unknown): value is UiDensity {
  return value === "compact" || value === "comfortable";
}

function isUiHeaderChrome(value: unknown): value is UiHeaderChrome {
  return value === "stacked" || value === "unified";
}

export function parseAppearancePreviewState(raw: unknown): AppearancePreviewState {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_APPEARANCE_PREVIEW;
  }

  const source = raw as Record<string, unknown>;

  return {
    generation: isUiGeneration(source.generation)
      ? source.generation
      : DEFAULT_APPEARANCE_PREVIEW.generation,
    visual: isUiVisualStyle(source.visual) ? source.visual : DEFAULT_APPEARANCE_PREVIEW.visual,
    density: isUiDensity(source.density) ? source.density : DEFAULT_APPEARANCE_PREVIEW.density,
    headerChrome:
      source.headerChrome === "stacked"
        ? "unified"
        : isUiHeaderChrome(source.headerChrome)
          ? source.headerChrome
          : DEFAULT_APPEARANCE_PREVIEW.headerChrome,
  };
}

export function readAppearancePreviewState(): AppearancePreviewState {
  if (typeof window === "undefined") {
    return DEFAULT_APPEARANCE_PREVIEW;
  }

  try {
    const raw = localStorage.getItem(APPEARANCE_PREVIEW_STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE_PREVIEW;
    return parseAppearancePreviewState(JSON.parse(raw));
  } catch {
    return DEFAULT_APPEARANCE_PREVIEW;
  }
}

export function persistAppearancePreviewState(state: AppearancePreviewState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(APPEARANCE_PREVIEW_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
