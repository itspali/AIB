import type { DrawerWidthPolicy } from "@/lib/layout/drawer-width-policy";
import { cn } from "@/lib/utils";

export type RightDrawerSurfaceVariant = "default" | "glass";

/** Outer shell class for frosted mutate drawers (create / edit). */
export const RIGHT_DRAWER_GLASS_SURFACE_CLASS = "right-drawer-glass-surface";

/** Scroll body tint inside a glass mutate drawer. */
export const RIGHT_DRAWER_GLASS_BODY_CLASS = "right-drawer-glass-body";

/** Glass shell only applies to mutate-width drawers — peek stays default. */
export function resolveRightDrawerSurfaceVariant(
  widthPolicy: DrawerWidthPolicy,
  surfaceVariant: RightDrawerSurfaceVariant = "default"
): RightDrawerSurfaceVariant {
  return widthPolicy === "mutate" && surfaceVariant === "glass" ? "glass" : "default";
}

export function rightDrawerGlassSurfaceClassName(active: boolean) {
  return active ? RIGHT_DRAWER_GLASS_SURFACE_CLASS : undefined;
}

export function rightDrawerGlassBodyClassName(active: boolean, className?: string) {
  return cn(active && RIGHT_DRAWER_GLASS_BODY_CLASS, className);
}
