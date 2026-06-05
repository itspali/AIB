"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildModuleHref,
  isDrawerOpen,
  moduleDrawerCreateHref,
  moduleDrawerEditHref,
  moduleDrawerPeekHref,
  parseModuleDrawerState,
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
  openPeek: (recordId: string, variantId?: string | null) => void;
  openEdit: (recordId: string, variantId?: string | null) => void;
  openCreate: () => void;
  close: () => void;
  afterSave: (recordId: string, variantId?: string | null) => void;
};

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

export function useModuleDrawerUrl(
  basePath: string,
  options: UseModuleDrawerUrlOptions = {}
): UseModuleDrawerUrlResult {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canonicalizedRef = useRef(false);
  const [pendingNav, setPendingNav] = useState<PendingNavigation | null>(null);

  const urlState = useMemo(
    () => parseModuleDrawerState(searchParams),
    [searchParams]
  );

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

  const navigate = useCallback(
    (href: string, method: "push" | "replace" = "push") => {
      if (method === "replace") {
        router.replace(href, { scroll: false });
      } else {
        router.push(href, { scroll: false });
      }
    },
    [router]
  );

  const openPeek = useCallback(
    (recordId: string, variantId?: string | null) => {
      const variant = variantId?.trim() || null;
      setPendingNav({ recordId, variantId: variant, action: null, surface: "peek" });
      navigate(moduleDrawerPeekHref(basePath, recordId, searchParams, variant));
    },
    [basePath, navigate, searchParams]
  );

  const openEdit = useCallback(
    (recordId: string, variantId?: string | null) => {
      const variant = variantId?.trim() || null;
      setPendingNav({ recordId, variantId: variant, action: "edit", surface: "edit" });
      navigate(moduleDrawerEditHref(basePath, recordId, searchParams, variant));
    },
    [basePath, navigate, searchParams]
  );

  const openCreate = useCallback(() => {
    setPendingNav({ recordId: null, variantId: null, action: "new", surface: "create" });
    navigate(moduleDrawerCreateHref(basePath, searchParams));
  }, [basePath, navigate, searchParams]);

  const close = useCallback(() => {
    setPendingNav({ recordId: null, variantId: null, action: null, surface: "closed" });
    navigate(buildModuleHref(basePath, { preserveParams: searchParams }), "replace");
  }, [basePath, navigate, searchParams]);

  const afterSave = useCallback(
    (recordId: string, variantId?: string | null) => {
      const variant = variantId?.trim() || null;
      setPendingNav({ recordId, variantId: variant, action: null, surface: "peek" });
      navigate(moduleDrawerPeekHref(basePath, recordId, searchParams, variant), "replace");
    },
    [basePath, navigate, searchParams]
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
    router.replace(href, { scroll: false });
  }, [
    basePath,
    options.canonicalizeLegacy,
    router,
    searchParams,
    state.action,
    state.needsCanonicalize,
    state.recordId,
    state.variantId,
  ]);

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
    openPeek,
    openEdit,
    openCreate,
    close,
    afterSave,
  };
}

export type { DrawerSurface };
