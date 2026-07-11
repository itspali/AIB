"use client";

import { useLayoutEffect, useRef } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { readActiveModuleViewId } from "@/lib/search/views/active-module-view-storage";
import { resolveModuleSavedViewRestoreTarget } from "@/lib/search/views/resolve-module-saved-view-restore";
import { scopeFromModuleName } from "@/lib/search/views/module-view-registry";
import type { CustomModuleView } from "@/lib/search/types";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";

type Options = {
  moduleName: string;
  initialSavedViews?: readonly CustomModuleView[];
  initialSavedView?: SavedViewSnapshot | null;
  initialFilteredItemIds?: string[] | null;
};

/**
 * Seeds the omnibar views cache from SSR and restores the active saved view.
 * When SSR missed the cookie, falls back to the last-selected id in localStorage
 * using the SSR-provided views list (no extra list fetch).
 */
export function useRestoreModuleSavedView({
  moduleName,
  initialSavedViews = [],
  initialSavedView = null,
  initialFilteredItemIds = null,
}: Options) {
  const omnibar = useOptionalOmnibarContext();
  const hydratedRef = useRef(false);

  useLayoutEffect(() => {
    if (!omnibar || hydratedRef.current) return;
    hydratedRef.current = true;

    if (initialSavedViews.length > 0) {
      omnibar.seedModuleViews(moduleName, initialSavedViews);
    }

    const target = resolveModuleSavedViewRestoreTarget({
      storedViewId: readActiveModuleViewId(moduleName),
      initialSavedViews,
      initialSavedView,
      initialFilteredItemIds,
    });

    if (target.kind === "hydrate") {
      omnibar.hydrateModuleViewFromServer(target.snapshot, target.filteredItemIds);
      return;
    }

    if (target.kind === "load") {
      omnibar.loadSavedView(target.view);
      return;
    }

    const scope = scopeFromModuleName(moduleName);
    if (scope) {
      omnibar.markDefaultViewResolvedOnServer(scope);
    }
  }, [initialFilteredItemIds, initialSavedView, initialSavedViews, moduleName, omnibar]);
}
