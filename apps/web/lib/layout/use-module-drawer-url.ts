"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  applyModuleDrawerHistory,
  buildModuleHref,
  isDrawerOpen,
  moduleDrawerCreateHref,
  moduleDrawerEditHref,
  moduleDrawerPeekHref,
  parseModuleDrawerState,
  parseModuleDrawerStateFromHref,
  parseModuleDrawerStateFromLocation,
  type DrawerSurface,
  type ModuleDrawerAction,
  type ModuleDrawerState,
} from "@/lib/layout/module-drawer-url";

type UseModuleDrawerUrlOptions = {
  /** Canonicalize legacy query params once on mount. */
  canonicalizeLegacy?: boolean;
};

type PendingNavigation = {
  recordId: string | null;
  variantId: string | null;
  action: ModuleDrawerAction | null;
  surface: DrawerSurface;
};

export type UseModuleDrawerUrlResult = ModuleDrawerState & {
  isOpen: boolean;
  href: string;
  /** Bumps when drawer history changes without a Next.js navigation. */
  historyEpoch: number;
  replaceDrawerHref: (href: string) => void;
  openPeek: (recordId: string, variantId?: string | null) => void;
  openEdit: (recordId: string, variantId?: string | null) => void;
  openCreate: () => void;
  close: () => void;
  afterSave: (recordId: string, variantId?: string | null) => void;
};

function livePreserveParams(fallback: ReturnType<typeof useSearchParams>): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams(fallback.toString());
  return new URLSearchParams(window.location.search);
}

function pendingMatchesUrl(
  pending: PendingNavigation,
  urlState: ModuleDrawerState
): boolean {
  return (
    pending.surface === urlState.surface &&
    (pending.recordId ?? null) === (urlState.recordId ?? null) &&
    (pending.variantId ?? null) === (urlState.variantId ?? null) &&
    (pending.action ?? null) === (urlState.action ?? null)
  );
}

function drawerStateToPending(state: ModuleDrawerState): PendingNavigation {
  return {
    recordId: state.recordId,
    variantId: state.variantId,
    action: state.action,
    surface: state.surface,
  };
}

export function useModuleDrawerUrl(
  basePath: string,
  options: UseModuleDrawerUrlOptions = {}
): UseModuleDrawerUrlResult {
  const searchParams = useSearchParams();
  const canonicalizedRef = useRef(false);
  const [pendingNav, setPendingNav] = useState<PendingNavigation | null>(null);
  const [historyEpoch, setHistoryEpoch] = useState(0);

  const urlState = useMemo(() => {
    if (typeof window !== "undefined") {
      return parseModuleDrawerStateFromLocation(window.location);
    }
    return parseModuleDrawerState(searchParams);
  }, [searchParams, historyEpoch]);

  const state = useMemo((): ModuleDrawerState => {
    if (!pendingNav) return urlState;
    if (pendingMatchesUrl(pendingNav, urlState)) return urlState;
    return {
      recordId: pendingNav.recordId,
      variantId: pendingNav.variantId,
      action: pendingNav.action,
      surface: pendingNav.surface,
      needsCanonicalize: false,
    };
  }, [pendingNav, urlState]);

  useEffect(() => {
    if (!pendingNav) return;
    if (pendingMatchesUrl(pendingNav, urlState)) {
      setPendingNav(null);
    }
  }, [pendingNav, urlState]);

  // Real Next.js navigations (filters, links) update searchParams — drop stale pending state.
  const searchParamsSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    setHistoryEpoch((epoch) => epoch + 1);
    const snapshot = searchParams.toString();
    if (searchParamsSnapshotRef.current === null) {
      searchParamsSnapshotRef.current = snapshot;
      return;
    }
    if (searchParamsSnapshotRef.current === snapshot) return;
    searchParamsSnapshotRef.current = snapshot;
    setPendingNav(null);
  }, [searchParams]);

  const syncHistory = useCallback(
    (href: string, pending: PendingNavigation, method: "push" | "replace" = "push") => {
      setPendingNav(pending);
      applyModuleDrawerHistory(href, method);
      setHistoryEpoch((epoch) => epoch + 1);
    },
    []
  );

  const replaceDrawerHref = useCallback((href: string) => {
    applyModuleDrawerHistory(href, "replace");
    setHistoryEpoch((epoch) => epoch + 1);
  }, []);

  const openPeek = useCallback(
    (recordId: string, variantId?: string | null) => {
      const variant = variantId?.trim() || null;
      if (
        state.surface === "peek" &&
        state.recordId === recordId &&
        (state.variantId ?? null) === variant
      ) {
        return;
      }
      syncHistory(
        moduleDrawerPeekHref(basePath, recordId, livePreserveParams(searchParams), variant),
        { recordId, variantId: variant, action: null, surface: "peek" }
      );
    },
    [basePath, searchParams, state.recordId, state.surface, state.variantId, syncHistory]
  );

  const openEdit = useCallback(
    (recordId: string, variantId?: string | null) => {
      const variant = variantId?.trim() || null;
      syncHistory(
        moduleDrawerEditHref(basePath, recordId, livePreserveParams(searchParams), variant),
        { recordId, variantId: variant, action: "edit", surface: "edit" }
      );
    },
    [basePath, searchParams, syncHistory]
  );

  const openCreate = useCallback(() => {
    syncHistory(moduleDrawerCreateHref(basePath, livePreserveParams(searchParams)), {
      recordId: null,
      variantId: null,
      action: "new",
      surface: "create",
    });
  }, [basePath, searchParams, syncHistory]);

  const close = useCallback(() => {
    syncHistory(
      buildModuleHref(basePath, { preserveParams: livePreserveParams(searchParams) }),
      { recordId: null, variantId: null, action: null, surface: "closed" },
      "replace"
    );
  }, [basePath, searchParams, syncHistory]);

  const afterSave = useCallback(
    (recordId: string, variantId?: string | null) => {
      const variant = variantId?.trim() || null;
      syncHistory(
        moduleDrawerPeekHref(basePath, recordId, livePreserveParams(searchParams), variant),
        { recordId, variantId: variant, action: null, surface: "peek" },
        "replace"
      );
    },
    [basePath, searchParams, syncHistory]
  );

  useEffect(() => {
    if (!options.canonicalizeLegacy || canonicalizedRef.current) return;
    if (!state.needsCanonicalize) return;

    canonicalizedRef.current = true;
    const href = buildModuleHref(basePath, {
      recordId: state.recordId,
      variantId: state.variantId,
      action: state.action,
      preserveParams: searchParams,
    });
    syncHistory(href, drawerStateToPending(parseModuleDrawerStateFromHref(href)), "replace");
  }, [
    basePath,
    options.canonicalizeLegacy,
    searchParams,
    state.action,
    state.needsCanonicalize,
    state.recordId,
    state.variantId,
    syncHistory,
  ]);

  useEffect(() => {
    const onPopState = () => {
      setHistoryEpoch((epoch) => epoch + 1);
      setPendingNav(
        drawerStateToPending(parseModuleDrawerStateFromLocation(window.location))
      );
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!isDrawerOpen(state.surface)) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (state.surface === "create") return;
      event.preventDefault();
      close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, state.surface]);

  const href = useMemo(
    () =>
      buildModuleHref(basePath, {
        recordId: state.recordId,
        variantId: state.variantId,
        action: state.action,
        preserveParams: searchParams,
      }),
    [basePath, searchParams, state.action, state.recordId, state.variantId]
  );

  return {
    ...state,
    isOpen: isDrawerOpen(state.surface),
    href,
    historyEpoch,
    replaceDrawerHref,
    openPeek,
    openEdit,
    openCreate,
    close,
    afterSave,
  };
}

export type { DrawerSurface };
