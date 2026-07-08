import { createContext, createElement, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared utility: bottom-border-only inputs inside marked form roots. */
export const FORM_FIELDS_BOTTOM_BORDER_CLASS = "form-fields-bottom-border";

/** Root class on the item editor form — enables bottom-border-only field styling. */
export const PRODUCT_EDITOR_FORM_CLASS = `product-editor-form ${FORM_FIELDS_BOTTOM_BORDER_CLASS}`;

/** Root class on the category editor — same field treatment as the item editor. */
export const CATEGORY_EDITOR_FORM_CLASS = `category-editor-form ${FORM_FIELDS_BOTTOM_BORDER_CLASS}`;

export const EditorPanelContext = createContext(false);

export function useEditorPanelLayout() {
  return useContext(EditorPanelContext);
}

/** Top-level wizard section cards inside {@link ItemEditorShell} — not nested widgets. */
export const EDITOR_GLASS_SECTION_CLASS = "editor-glass-section";

const EditorGlassSectionsContext = createContext(false);

export function EditorGlassSectionsProvider({
  children,
  value = true,
}: {
  children: ReactNode;
  value?: boolean;
}) {
  return createElement(EditorGlassSectionsContext.Provider, { value }, children);
}

export function useEditorGlassSections() {
  return useContext(EditorGlassSectionsContext);
}

/** Glass V2 outer section card (drawer wizard only). */
export function editorGlassSectionClass() {
  return cn("surface-panel editor-glass-section space-y-3 overflow-hidden");
}

export type EditorCardClassOptions = {
  glass?: boolean;
};

export function editorCardClassName(
  panel: boolean,
  variant: "summary" | "section" = "section",
  options?: EditorCardClassOptions
) {
  if (panel && options?.glass) {
    return editorGlassSectionClass();
  }
  return panel ? editorPanelSectionClass() : editorPageSectionClass(variant);
}

/** Body padding for glass section cards (inline title, no heading band). */
export function editorGlassSectionBodyClass() {
  return "space-y-3";
}

/** Panel section card — light border for separation without nested boxes. */
export function editorPanelSectionClass() {
  return cn(
    "editor-section-panel overflow-hidden rounded-md border border-border/50",
    "bg-muted/25 px-3.5 py-3 dark:bg-muted/10"
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
  return cn(panel ? "space-y-3 pt-6" : "space-y-4 p-4 pt-4 sm:p-6 sm:pt-5");
}

export function editorSubsectionClass(panel: boolean) {
  return panel
    ? "space-y-2.5 border-t border-border/50 pt-4 first:border-t-0 first:pt-0"
    : "mt-5 space-y-3";
}

/** Divider between sibling blocks inside one panel section (e.g. matrix vs variant table). */
export function editorPanelDividerClass(className?: string) {
  return cn("border-t border-border/50 pt-4", className);
}

/** Centered “Show more / Hide advanced” row with a full-width line behind the label. */
export function editorSectionDisclosureRowClass() {
  return "relative flex w-full items-center";
}

export function editorSectionDisclosureLineClass() {
  return "pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/50";
}

export function editorSectionDisclosureButtonClass(panel: boolean) {
  return cn(
    "relative z-[1] mx-auto h-7 px-3 text-xs font-medium text-primary hover:text-primary",
    panel
      ? "bg-muted/15 hover:bg-muted/25 dark:bg-muted/10 dark:hover:bg-muted/20"
      : "bg-background hover:bg-accent"
  );
}

/** Vertical rhythm between top-level panel sections in the scroll column. */
export function editorPanelSectionStackClass() {
  return "space-y-4";
}

/** Shared heading band — full width, higher contrast on light and dark surfaces. */
const editorHeadingBgClass = "w-full bg-secondary text-foreground dark:bg-secondary/80";

/** Main section title band (Overview, Pricing, etc.). */
export function editorSectionHeadingClass(panel: boolean) {
  return cn(
    panel
      ? "-mx-3.5 -mt-3 mb-0 border-b border-border/50 bg-muted/25 px-3.5 pb-3 pt-2.5 dark:bg-muted/20"
      : cn(editorHeadingBgClass, "border-b border-border px-4 py-2.5 sm:px-6")
  );
}

/** Wrapper for subsection titles with an info icon (Units, Catalog blocks). */
export function editorSubsectionHeadingWrapClass(className?: string) {
  return cn("flex w-full items-center gap-1.5 px-3 py-2", editorHeadingBgClass, className);
}

/** In-section h4 headings (Status, Shipping, price books, etc.). */
export function editorSubsectionHeadingClass(panel: boolean) {
  return panel
    ? "border-t border-border/40 pt-3 text-xs font-medium text-muted-foreground first:border-t-0 first:pt-0"
    : cn(
        editorHeadingBgClass,
        "block py-2 font-medium",
        "-mx-3 px-3 text-sm sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6"
      );
}

export function editorEmptyStateClass(panel: boolean, className?: string) {
  return cn(
    panel
      ? "py-1 text-xs leading-snug text-muted-foreground"
      : "rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground",
    className
  );
}

/** Compact dashed placeholder with optional primary action (panel advanced sections). */
export function editorDeferredActionClass(panel: boolean, className?: string) {
  return cn(
    "space-y-2 rounded-md border border-dashed border-border/50 bg-muted/10",
    panel ? "px-3 py-2" : "px-4 py-3",
    className
  );
}

export function editorReadOnlyFieldClass(panel: boolean) {
  return panel
    ? "rounded-md bg-muted/30 px-2.5 py-1.5 text-sm"
    : "rounded-md border border-border bg-muted/30 px-3 py-2 text-sm";
}

/** Primary field labels in catalog editors (item + category forms). */
export function editorFieldLabelClass(panel?: boolean) {
  return cn("font-medium text-primary", panel ? "text-xs" : "text-sm");
}

/** Inline hint copy when “Show help” is enabled in catalog editors. */
export function editorFieldInlineHintClass(panel?: boolean) {
  return cn("leading-snug text-muted-foreground", panel ? "text-[11px]" : "text-xs");
}

/** Two-column field grids from md breakpoint; panel drawer uses two columns in the form column. */
export function editorGridClass(panel: boolean) {
  return cn(
    "grid grid-cols-1 gap-y-8",
    panel ? "grid-cols-2 gap-x-10 gap-y-6" : "md:grid-cols-2 md:gap-x-10 md:gap-y-8"
  );
}

/** Full-width row inside editorGridClass (name, description, toggles, etc.). */
export function editorFieldSpanFullClass(_panel?: boolean) {
  return "col-span-2";
}

/** Length, width, height on one row (inside a full-width grid row). */
export function editorDimensionsLwhGridClass() {
  return "grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-4";
}

/** Length, width, height, and weight — two rows in panel; one row from md in full-page editors. */
export function editorShippingDimensionsGridClass(panel: boolean) {
  return cn(
    "grid grid-cols-2",
    panel ? "gap-x-10 gap-y-6" : "gap-x-10 gap-y-8 md:grid-cols-4"
  );
}

/** Stacked toggle rows without line separators between them (e.g. Salable / Returnable / Purchasable). */
export function editorToggleGroupClass(panel: boolean) {
  return cn("editor-toggle-group", editorFieldSpanFullClass(panel), panel ? "space-y-0.5" : "space-y-1");
}

export function editorInsetTableWrapClass(panel: boolean) {
  return panel
    ? "table-chrome-frame overflow-x-auto"
    : "table-chrome-frame overflow-x-auto rounded-lg border border-border";
}

/** Panel width at or below which section tabs move to the top strip (not left rail). */
export const EDITOR_PANEL_HORIZONTAL_RAIL_MAX_WIDTH_PX = 560;

/** Viewports below `lg` use the top section strip in drawer editors. */
export const EDITOR_PANEL_TOP_TABS_VIEWPORT_MEDIA = "(max-width: 1023px)";

/** Minimum drawer pane width for the wizard stage left rail (fallback when vw is unavailable). */
export const EDITOR_WIZARD_LEFT_RAIL_MIN_PANE_PX = 720;

/** Drawer width preset (vw) at which the wizard shows the left stage rail (matches 60 / 80 presets). */
export const EDITOR_WIZARD_LEFT_RAIL_MIN_DRAWER_VW = 60;

export function resolveEditorPanelHorizontalRail(paneWidth: number | undefined): boolean {
  return paneWidth != null && paneWidth <= EDITOR_PANEL_HORIZONTAL_RAIL_MAX_WIDTH_PX;
}

export function resolveEditorPanelUseTopTabs(
  paneWidth: number | undefined,
  compactViewport: boolean
): boolean {
  return compactViewport || resolveEditorPanelHorizontalRail(paneWidth);
}

/** Wizard stages: left rail on wide drawer panes; top stepper when narrow. */
export function resolveWizardUseLeftRail(
  isPanelLayout: boolean,
  paneWidth: number | undefined,
  compactViewport: boolean,
  drawerWidthVw?: number
): boolean {
  if (compactViewport) return false;
  if (!isPanelLayout) return true;
  if (drawerWidthVw != null) {
    return drawerWidthVw >= EDITOR_WIZARD_LEFT_RAIL_MIN_DRAWER_VW;
  }
  return paneWidth != null && paneWidth >= EDITOR_WIZARD_LEFT_RAIL_MIN_PANE_PX;
}

/** Width of the sticky section rail in the detail-panel editor (keep in sync with grid class below). */
export function editorPanelLayoutGridClass(horizontalRail = false) {
  return horizontalRail
    ? "grid min-w-0 grid-cols-1 gap-2"
    : "grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-2";
}

/** Left wizard stepper rail in the panel drawer (wider than the section nav rail). */
export function editorPanelWizardLayoutGridClass() {
  return "grid min-h-0 min-w-0 flex-1 grid-cols-[12rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch gap-0 overflow-hidden";
}

/** Left wizard stepper rail on the full-page create flow. */
export function editorPageWizardLayoutGridClass() {
  return "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch lg:gap-0";
}

/** Horizontal bleed + top flush with drawer body (matches RightDrawer px-4 py-4 sm:px-6). */
export function editorPanelWizardBleedClass() {
  return "-mx-4 -mt-4 sm:-mx-6 sm:-mt-6";
}

/** Same bleed, only from the `lg` breakpoint (when the left stage rail is shown). */
export function editorPanelWizardBleedLgClass() {
  return "lg:-mx-6 lg:-mt-6";
}

/** Bottom inset so the last section can scroll fully above the drawer edge. */
export function editorPanelWizardScrollClass() {
  return "pb-4 sm:pb-6";
}

/** Scroll column beside the wizard left rail — top inset clears the bleed pull-up. */
export function editorPanelWizardFormScrollClass() {
  return "h-full max-h-full pl-3 pr-4 pt-5 sm:pr-6 sm:pt-7";
}

/** Wizard stage rail / top bar surface — visible on light and dark canvases. */
export function editorWizardRailBgClass() {
  return "bg-muted/50 dark:bg-secondary";
}

/** Full-width stage strip above the form when the left rail is hidden. */
export function editorWizardTopBarClass(panel = false) {
  return cn(
    "shrink-0 border-b border-border/60",
    editorWizardRailBgClass(),
    panel
      ? "-mx-4 -mt-4 px-4 pb-1.5 pt-4 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pb-1.5 sm:pt-6"
      : "py-1.5"
  );
}

/** Glass V2 top stepper strip inside {@link ItemEditorShell}. */
export function editorWizardTopBarGlassClass(panel = false) {
  return cn(
    editorWizardTopBarClass(panel),
    "border-border/50 bg-background/35 backdrop-blur-xl supports-[backdrop-filter]:bg-background/25",
    "dark:bg-secondary/55 dark:supports-[backdrop-filter]:bg-secondary/45"
  );
}

/** Full-height tinted column for the left wizard stage rail. */
export function editorWizardLeftRailAsideClass(_panel = false) {
  return cn(
    "flex h-full min-h-0 min-w-0 flex-col self-stretch border-r border-border/60",
    editorWizardRailBgClass()
  );
}

/** Glass V2 left wizard rail inside {@link ItemEditorShell}. */
export function editorWizardLeftRailGlassAsideClass(panel = false) {
  return cn(
    editorWizardLeftRailAsideClass(panel),
    "border-border/50 bg-background/30 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20",
    "dark:bg-secondary/50 dark:supports-[backdrop-filter]:bg-secondary/40"
  );
}

export function editorWizardLeftRailInnerClass(panel = false) {
  return cn(
    "flex h-full min-h-0 w-full flex-1 flex-col bg-inherit",
    panel ? "pb-3 pl-4 pr-2 pt-4 sm:pl-6 sm:pt-6" : "px-3 py-3"
  );
}

export function editorWizardLeftRailStickyClass() {
  return cn("sticky z-10 w-full min-w-0", PANEL_SCROLL_TOP_OFFSET);
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
    ? "space-y-2.5 border-t border-border/50 pt-4 first:border-t-0 first:pt-0"
    : "space-y-3";
}

/** Compact switch for dense product editor forms (panel and full page). */
export const editorSwitchSize = "sm" as const;
