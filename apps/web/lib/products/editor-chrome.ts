import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

/** Root class on the item editor form — enables bottom-border-only field styling. */
export const PRODUCT_EDITOR_FORM_CLASS = "product-editor-form form-fields-bottom-border";

export const EditorPanelContext = createContext(false);

export function useEditorPanelLayout() {
  return useContext(EditorPanelContext);
}

/** Flat section styling for the detail-panel editor — soft cards, not nested chrome. */
export function editorPanelSectionClass() {
  return cn(
    "editor-section-panel overflow-hidden rounded-md border border-border/80",
    "bg-muted/25 dark:bg-muted/15"
  );
}

export function editorPageSectionClass(variant: "summary" | "section" = "section") {
  return cn(
    "surface-panel",
    // `surface-panel` (defined later in the utilities layer) applies p-4, which
    // beats a plain `p-0`. Force it off so the full-width heading band is flush
    // with the card edges; the section body supplies its own padding.
    variant === "summary" ? "p-4 sm:p-5" : "overflow-hidden !p-0"
  );
}

/** Padded body below a full-width section heading band. */
export function editorSectionBodyClass(panel: boolean) {
  return cn(panel ? "space-y-3 p-3.5 pt-4" : "space-y-4 p-4 pt-4 sm:p-6 sm:pt-5");
}

export function editorSubsectionClass(panel: boolean) {
  // Page layout leads each subsection with a full-width heading band, so the band
  // itself is the separator (no inset top divider). Panel layout keeps the divider
  // since its heading bands are usually hidden.
  return panel
    ? "mt-4 space-y-2 border-t border-border/60 pt-3"
    : "mt-5 space-y-3";
}

/** Shared heading band — full width, higher contrast on light and dark surfaces. */
const editorHeadingBgClass = "w-full bg-secondary text-foreground dark:bg-secondary/80";

/** Main section title band (Overview, Pricing, etc.). */
export function editorSectionHeadingClass(panel: boolean) {
  return cn(
    editorHeadingBgClass,
    "border-b border-border",
    panel ? "px-3.5 py-2.5" : "px-4 py-2.5 sm:px-6"
  );
}

/** Wrapper for subsection titles with an info icon (Units, Catalog blocks). */
export function editorSubsectionHeadingWrapClass(className?: string) {
  return cn("flex w-full items-center gap-1.5 px-3 py-2", editorHeadingBgClass, className);
}

/** In-section h4 headings (Status, Shipping, price books, etc.). */
export function editorSubsectionHeadingClass(panel: boolean) {
  return cn(
    editorHeadingBgClass,
    "block py-2 font-medium",
    // Break out of the section body's horizontal padding so the heading band
    // stretches edge-to-edge, matching the main section header.
    panel ? "-mx-3.5 px-3.5 text-xs" : "-mx-4 px-4 text-sm sm:-mx-6 sm:px-6"
  );
}

export function editorEmptyStateClass(panel: boolean, className?: string) {
  return cn(
    panel
      ? "py-2 text-sm text-muted-foreground"
      : "rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground",
    className
  );
}

export function editorReadOnlyFieldClass(panel: boolean) {
  return panel
    ? "rounded-md bg-muted/30 px-2.5 py-1.5 text-sm"
    : "rounded-md border border-border bg-muted/30 px-3 py-2 text-sm";
}

export function editorGridClass(panel: boolean) {
  return cn("grid grid-cols-1 sm:grid-cols-2", panel ? "gap-3" : "gap-4");
}

export function editorInsetTableWrapClass(panel: boolean) {
  return panel ? "overflow-x-auto" : "overflow-x-auto rounded-lg border border-border";
}

/** Panel width at or below which the section rail stacks above content (horizontal chips). */
export const EDITOR_PANEL_HORIZONTAL_RAIL_MAX_WIDTH_PX = 400;

export function resolveEditorPanelHorizontalRail(paneWidth: number | undefined): boolean {
  return paneWidth != null && paneWidth <= EDITOR_PANEL_HORIZONTAL_RAIL_MAX_WIDTH_PX;
}

/** Width of the sticky section rail in the detail-panel editor (keep in sync with grid class below). */
export function editorPanelLayoutGridClass(horizontalRail = false) {
  return horizontalRail
    ? "grid min-w-0 grid-cols-1 gap-2"
    : "grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-2";
}

/** Gap between detail-pane scroll top and section content (matches sticky nav offset). */
export const PANEL_SCROLL_TOP_OFFSET = "top-5";

export function editorPanelScrollMarginClass() {
  return "scroll-mt-5";
}

export function editorPanelSectionRailClass(horizontalRail = false) {
  return horizontalRail ? "min-w-0 w-full" : "min-w-0 w-full max-w-[7rem] shrink-0";
}

export function editorPanelSectionRailStickyClass(horizontalRail = false) {
  return cn(
    "sticky z-10 w-full min-w-0 rounded-md pb-1",
    "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90",
    PANEL_SCROLL_TOP_OFFSET,
    horizontalRail ? "chip-scroll-track flex touch-pan-x gap-1 overflow-x-auto overscroll-x-contain" : "self-start space-y-0.5"
  );
}

export function editorPanelBadgesClass() {
  return "flex flex-wrap gap-1.5";
}

export function editorCatalogBlockClass(compact: boolean) {
  return compact
    ? "space-y-2.5 border-t border-border/60 pt-4 first:border-t-0 first:pt-0"
    : "space-y-3";
}

/** Compact switch for dense product editor forms (panel and full page). */
export const editorSwitchSize = "sm" as const;
