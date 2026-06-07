import { cn } from "@/lib/utils";

/** Shared compact-but-readable control scale for the list meta toolbar. */
export const LIST_TOOLBAR_CONTROL_HEIGHT = "h-7";
export const LIST_TOOLBAR_TEXT = "text-sm";
export const LIST_TOOLBAR_ROW_MIN_HEIGHT = "min-h-9";
export const LIST_TOOLBAR_ROW_GAP = "gap-3 md:gap-4 dark:gap-4 md:dark:gap-5";
export const LIST_TOOLBAR_TOOLS_GAP = "gap-3 md:gap-3.5 dark:gap-4 md:dark:gap-5";

const TOOLBAR_BORDERLESS_BASE =
  "border-0 bg-transparent shadow-none hover:bg-accent/50 dark:rounded-md dark:bg-[hsl(224_47%_13%)] dark:hover:bg-[hsl(224_47%_17%)]";

export function listToolbarControlActiveClass(active: boolean): string {
  return active
    ? "font-medium text-primary [&_svg]:text-primary"
    : "text-muted-foreground [&_svg]:text-muted-foreground";
}

export function listToolbarSelectClass(active = false): string {
  return cn(
    LIST_TOOLBAR_CONTROL_HEIGHT,
    "shrink-0 shadow-none [&>span]:truncate [&>svg]:h-4 [&>svg]:w-4 [&>svg]:opacity-70",
    LIST_TOOLBAR_TEXT,
    TOOLBAR_BORDERLESS_BASE,
    active && "[&>svg]:text-primary [&>svg]:opacity-100",
    listToolbarControlActiveClass(active)
  );
}

export function listToolbarViewToggleShellClass(): string {
  return cn(
    "inline-flex shrink-0 items-center rounded-md bg-muted/80 p-0.5 ring-1 ring-border/60",
    "dark:bg-[hsl(224_47%_16%)] dark:ring-border/70",
    LIST_TOOLBAR_CONTROL_HEIGHT
  );
}

export function listToolbarViewToggleButtonClass(): string {
  return "h-6 w-6 p-0 focus-visible:ring-1 focus-visible:ring-ring";
}

/** Selected/unselected segment inside `listToolbarViewToggleShellClass` (view toggles, sort). */
export function listToolbarViewToggleSegmentClass(selected = false): string {
  return cn(
    listToolbarViewToggleButtonClass(),
    "transition-colors duration-200",
    selected
      ? "bg-background text-primary shadow-sm hover:bg-background hover:text-primary"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"
  );
}

/** Icon-only sort control inside `listToolbarViewToggleShellClass`. */
export function listToolbarSortTriggerClass(active = false): string {
  return cn(
    listToolbarViewToggleSegmentClass(active),
    "border-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0",
    !active && "bg-transparent",
    "data-[state=open]:bg-background data-[state=open]:text-primary data-[state=open]:shadow-sm",
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
    active && "[&>svg]:text-primary [&>svg]:opacity-100",
    listToolbarControlActiveClass(active)
  );
}

export function listToolbarGhostTriggerClass(active = false): string {
  return cn(TOOLBAR_BORDERLESS_BASE, listToolbarControlActiveClass(active));
}
