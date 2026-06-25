import { cn } from "@/lib/utils";

/** Shared compact-but-readable control scale for the list meta toolbar. */
export const LIST_TOOLBAR_CONTROL_HEIGHT = "h-7";
export const LIST_TOOLBAR_TEXT = "text-sm";
export const LIST_TOOLBAR_ROW_MIN_HEIGHT = "min-h-9";
export const LIST_TOOLBAR_ROW_GAP = "gap-3 md:gap-4 dark:gap-4 md:dark:gap-5";
export const LIST_TOOLBAR_TOOLS_GAP = "gap-3 md:gap-3.5 dark:gap-4 md:dark:gap-5";

const TOOLBAR_BORDERLESS_BASE =
  "border-0 bg-transparent shadow-none hover:bg-transparent";

export function listToolbarControlActiveClass(active: boolean): string {
  return active
    ? "font-medium text-primary [&_svg]:text-primary"
    : "text-muted-foreground [&_svg]:text-muted-foreground";
}

export function listToolbarSelectClass(active = false): string {
  return cn(
    LIST_TOOLBAR_CONTROL_HEIGHT,
    "w-auto max-w-[11rem] shrink-0 shadow-none [&>span]:truncate [&>svg]:h-4 [&>svg]:w-4 [&>svg]:opacity-70",
    LIST_TOOLBAR_TEXT,
    TOOLBAR_BORDERLESS_BASE,
    "focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-transparent",
    "data-[state=open]:bg-transparent data-[state=open]:text-primary data-[state=open]:ring-0 data-[state=open]:border-transparent data-[state=open]:shadow-none",
    active && "[&>svg]:text-primary [&>svg]:opacity-100",
    listToolbarControlActiveClass(active)
  );
}

export function listToolbarViewToggleShellClass(): string {
  return cn("inline-flex shrink-0 items-center", LIST_TOOLBAR_CONTROL_HEIGHT);
}

export function listToolbarViewToggleButtonClass(): string {
  return "h-6 w-6 p-0 focus-visible:ring-1 focus-visible:ring-ring";
}

/** Selected/unselected segment inside `listToolbarViewToggleShellClass` (view toggles, sort). */
export function listToolbarViewToggleSegmentClass(selected = false): string {
  return cn(
    listToolbarViewToggleButtonClass(),
    "bg-transparent transition-colors duration-200 hover:bg-transparent",
    selected
      ? "font-medium text-primary hover:text-primary [&_svg]:text-primary"
      : "text-muted-foreground hover:text-foreground"
  );
}

/** Icon-only sort control inside `listToolbarViewToggleShellClass`. */
export function listToolbarSortTriggerClass(active = false): string {
  return cn(
    listToolbarViewToggleSegmentClass(active),
    "border-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0",
    "data-[state=open]:bg-transparent data-[state=open]:text-primary data-[state=open]:shadow-none",
    "justify-center gap-0 px-0 [&>span]:hidden [&>svg:last-child]:hidden"
  );
}

export function listToolbarIconButtonClass(active = false): string {
  return cn(
    LIST_TOOLBAR_CONTROL_HEIGHT,
    "w-auto min-w-7 shrink-0 px-1.5",
    TOOLBAR_BORDERLESS_BASE,
    "[&_svg]:h-4 [&_svg]:w-4",
    listToolbarControlActiveClass(active)
  );
}

/** Fits "★ All items" at text-sm; longer view names truncate. */
export const LIST_TOOLBAR_MODULE_VIEW_WIDTH = "w-[7.5rem]";

export function listToolbarModuleViewTriggerClass(active = false): string {
  return cn(
    LIST_TOOLBAR_CONTROL_HEIGHT,
    "gap-1.5 px-2 shadow-none [&>svg]:h-4 [&>svg]:w-4 [&>svg]:opacity-70",
    LIST_TOOLBAR_TEXT,
    TOOLBAR_BORDERLESS_BASE,
    "focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-transparent",
    "data-[state=open]:bg-transparent data-[state=open]:text-primary data-[state=open]:ring-0 data-[state=open]:border-transparent data-[state=open]:shadow-none",
    active && "[&>svg]:text-primary [&>svg]:opacity-100",
    listToolbarControlActiveClass(active)
  );
}

export function listToolbarGhostTriggerClass(active = false): string {
  return cn(TOOLBAR_BORDERLESS_BASE, listToolbarControlActiveClass(active));
}
