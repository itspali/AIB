import type { CustomModuleView } from "@/lib/search/types";

/** Picks the last-active view when valid, otherwise the system default. */
export function resolveActiveCustomModuleView(
  views: readonly CustomModuleView[],
  preferredViewId?: string | null
): CustomModuleView | null {
  if (views.length === 0) return null;

  const trimmedPreferred = preferredViewId?.trim();
  if (trimmedPreferred) {
    const preferred = views.find((view) => view.id === trimmedPreferred);
    if (preferred) return preferred;
  }

  return views.find((view) => view.is_system_default) ?? null;
}
