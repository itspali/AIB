import type { CustomModuleView } from "@/lib/search/types";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";

export type ModuleSavedViewRestoreTarget =
  | {
      kind: "hydrate";
      snapshot: SavedViewSnapshot;
      filteredItemIds: string[] | null;
    }
  | { kind: "load"; view: CustomModuleView }
  | { kind: "none" };

/**
 * Resolves how to restore the active saved view on the client.
 * Prefers the last-selected view id (localStorage/cookie) when it differs from SSR.
 */
export function resolveModuleSavedViewRestoreTarget(input: {
  storedViewId: string | null;
  initialSavedViews: readonly CustomModuleView[];
  initialSavedView: SavedViewSnapshot | null;
  initialFilteredItemIds: string[] | null;
}): ModuleSavedViewRestoreTarget {
  const { storedViewId, initialSavedViews, initialSavedView, initialFilteredItemIds } = input;

  const storedView = storedViewId
    ? initialSavedViews.find((view) => view.id === storedViewId)
    : undefined;

  if (storedView) {
    if (initialSavedView?.id === storedView.id) {
      return {
        kind: "hydrate",
        snapshot: initialSavedView,
        filteredItemIds: initialFilteredItemIds,
      };
    }
    return { kind: "load", view: storedView };
  }

  if (initialSavedView) {
    return {
      kind: "hydrate",
      snapshot: initialSavedView,
      filteredItemIds: initialFilteredItemIds,
    };
  }

  return { kind: "none" };
}
