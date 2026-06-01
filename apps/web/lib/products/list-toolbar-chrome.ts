import { cn } from "@/lib/utils";

/** Shared compact-but-readable control scale for the list meta toolbar. */
export const LIST_TOOLBAR_CONTROL_HEIGHT = "h-7";
export const LIST_TOOLBAR_TEXT = "text-sm";
export const LIST_TOOLBAR_ROW_MIN_HEIGHT = "min-h-9";

const TOOLBAR_BORDERLESS_BASE =
  "border-0 bg-transparent shadow-none hover:bg-accent/50";

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
    "inline-flex shrink-0 items-center rounded-md bg-muted/60 p-0.5",
    LIST_TOOLBAR_CONTROL_HEIGHT
  );
}

export function listToolbarViewToggleButtonClass(): string {
  return "h-6 w-6 p-0 focus-visible:ring-1 focus-visible:ring-ring";
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

export function listToolbarModuleViewTriggerClass(active = false): string {
  return cn(
    LIST_TOOLBAR_CONTROL_HEIGHT,
    "px-2.5 shadow-none [&>svg]:h-4 [&>svg]:w-4 [&>svg]:opacity-70",
    LIST_TOOLBAR_TEXT,
    TOOLBAR_BORDERLESS_BASE,
    active && "[&>svg]:text-primary [&>svg]:opacity-100",
    listToolbarControlActiveClass(active)
  );
}

export function listToolbarGhostTriggerClass(active = false): string {
  return cn(TOOLBAR_BORDERLESS_BASE, listToolbarControlActiveClass(active));
}
