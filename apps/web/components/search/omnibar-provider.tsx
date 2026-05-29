"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  executeModuleFilter,
  logSearchTelemetry,
  resolveSearchFieldPermissions,
} from "@/app/search/actions";
import { getDefaultCustomModuleView } from "@/app/search/views/actions";
import { compileFilterQuery } from "@/lib/search/compiler/compile";
import { isDraftReadyFilterClause } from "@/lib/search/compiler/parser";
import { buildFieldDict } from "@/lib/search/permissions/resolve-field-dict";
import { validateFilterAst } from "@/lib/search/executor/validate-ast";
import {
  getCachedSearchPermissions,
  invalidateSearchPermissions,
  setCachedSearchPermissions,
  setThrottledSearch,
} from "@/lib/search/permissions/session-cache";
import { scanQueryForSecuritySignatures } from "@/lib/search/telemetry/signatures";
import {
  getScopePlaceholder,
  resolveScopeFromPath,
  type ScopeDefinition,
  SCOPE_DEFINITIONS,
} from "@/lib/search/scopes";
import type {
  AstClause,
  CompileResult,
  CustomModuleView,
  FilterScope,
  SearchFieldPermissions,
} from "@/lib/search/types";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";
import {
  extractStructuralAst,
  isSavedViewDirty,
  normalizeSavedViewQuery,
} from "@/lib/search/views/saved-view-utils";
import { isSavedViewsScope, getModuleViewDefinition } from "@/lib/search/views/module-view-registry";
import type { OperatorProfile } from "@/lib/user/types";

type OmnibarContextValue = {
  rawQuery: string;
  setRawQuery: (value: string) => void;
  appliedQuery: string;
  submitFilter: () => void;
  hasPendingFilter: boolean;
  scope: FilterScope;
  setScope: (scope: FilterScope) => void;
  scopePinnedToAll: boolean;
  placeholder: string;
  scopeOptions: ScopeDefinition[];
  compileResult: CompileResult | null;
  activeAst: AstClause[];
  residualText: string;
  filteredItemIds: Set<string> | null;
  permissions: SearchFieldPermissions | null;
  clearFilters: () => void;
  removeClauseAt: (index: number) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  cancelCommandPalette: () => void;
  modalDraftAst: AstClause[];
  addDraftCriterion: () => void;
  removeDraftCriterionAt: (index: number) => void;
  clearModalDraft: () => void;
  applyModalFilters: () => void;
  canApplyModal: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  focusInput: () => void;
  isExecuting: boolean;
  moduleFilterRevision: number;
  refreshSearchPermissions: () => Promise<void>;
  activeSavedViewId: string | null;
  activeSavedView: SavedViewSnapshot | null;
  isSavedViewDirty: boolean;
  loadSavedView: (view: CustomModuleView) => void;
  loadSavedViewAndEdit: (view: CustomModuleView) => void;
  editActiveViewCriteria: () => void;
  clearActiveSavedView: () => void;
  setActiveSavedViewSnapshot: (view: SavedViewSnapshot | null) => void;
  notifySavedViewsChanged: () => void;
  savedViewsRevision: number;
};

const OmnibarContext = createContext<OmnibarContextValue | null>(null);

type Props = {
  children: ReactNode;
  operatorProfile?: OperatorProfile | null;
  tenantId?: string | null;
};

export function OmnibarProvider({ children, operatorProfile, tenantId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [rawQuery, setRawQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [scope, setScopeState] = useState<FilterScope>(() => resolveScopeFromPath(pathname));
  const [scopePinnedToAll, setScopePinnedToAll] = useState(false);
  const [permissions, setPermissions] = useState<SearchFieldPermissions | null>(null);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [filteredItemIds, setFilteredItemIds] = useState<Set<string> | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [moduleFilterRevision, setModuleFilterRevision] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [modalDraftSegments, setModalDraftSegments] = useState<string[]>([]);
  const [activeSavedView, setActiveSavedView] = useState<SavedViewSnapshot | null>(null);
  const [savedViewsRevision, setSavedViewsRevision] = useState(0);
  const [openPaletteAfterViewLoad, setOpenPaletteAfterViewLoad] = useState(false);
  const defaultLoadedForScopeRef = useRef<Set<FilterScope>>(new Set());
  const routeScopeRef = useRef<FilterScope>(scope);

  const userId = operatorProfile?.userId ?? null;
  const cacheTenantId = tenantId ?? "session";

  useEffect(() => {
    if (!userId) return;

    const cached = getCachedSearchPermissions(userId, cacheTenantId);
    if (cached) {
      setPermissions(cached);
      return;
    }

    void resolveSearchFieldPermissions().then((resolved) => {
      setPermissions(resolved);
      setCachedSearchPermissions(userId, cacheTenantId, resolved);
    });
  }, [userId, cacheTenantId]);

  useEffect(() => {
    if (scopePinnedToAll) return;
    const nextScope = resolveScopeFromPath(pathname);
    if (routeScopeRef.current !== nextScope) {
      setRawQuery("");
      setAppliedQuery("");
      setCompileResult(null);
      setFilteredItemIds(null);
      setActiveSavedView(null);
      setModalDraftSegments([]);
      setOpenPaletteAfterViewLoad(false);
      setModuleFilterRevision((value) => value + 1);
      routeScopeRef.current = nextScope;
    }
    setScopeState(nextScope);
  }, [pathname, scopePinnedToAll]);

  const setScope = useCallback(
    (nextScope: FilterScope) => {
      if (nextScope === scope) return;

      if (nextScope === "all") {
        setScopePinnedToAll(true);
        setScopeState("all");
        setRawQuery("");
        setAppliedQuery("");
        setCompileResult(null);
        setFilteredItemIds(null);
        setActiveSavedView(null);
        setModuleFilterRevision((value) => value + 1);
        return;
      }

      setScopePinnedToAll(false);
      setScopeState(nextScope);
    },
    [scope]
  );

  const clearActiveSavedView = useCallback(() => {
    setActiveSavedView(null);
  }, []);

  const setActiveSavedViewSnapshot = useCallback((view: SavedViewSnapshot | null) => {
    setActiveSavedView(view);
  }, []);

  const notifySavedViewsChanged = useCallback(() => {
    setSavedViewsRevision((value) => value + 1);
  }, []);

  const clearFilters = useCallback(() => {
    setRawQuery("");
    setAppliedQuery("");
    setCompileResult(null);
    setFilteredItemIds(null);
    setModalDraftSegments([]);
    setActiveSavedView(null);
    setOpenPaletteAfterViewLoad(false);
    setModuleFilterRevision((value) => value + 1);
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const openCommandPalette = useCallback(() => {
    setModalDraftSegments(
      compileResult?.clauseSegments ? [...compileResult.clauseSegments] : []
    );
    setRawQuery("");
    setCommandOpen(true);
  }, [compileResult?.clauseSegments]);

  const closeCommandPalette = useCallback(() => {
    setCommandOpen(false);
    setModalDraftSegments([]);
    setRawQuery("");
  }, []);

  const cancelCommandPalette = useCallback(() => {
    closeCommandPalette();
  }, [closeCommandPalette]);

  const clearModalDraft = useCallback(() => {
    setModalDraftSegments([]);
    setRawQuery("");
  }, []);

  const addDraftCriterion = useCallback(() => {
    const trimmed = rawQuery.trim();
    if (!trimmed || !permissions) return;
    const fieldDict = buildFieldDict(scope, permissions);
    if (!isDraftReadyFilterClause(trimmed, fieldDict)) return;
    setModalDraftSegments((segments) => [...segments, trimmed]);
    setRawQuery("");
  }, [rawQuery, permissions, scope]);

  const removeDraftCriterionAt = useCallback((index: number) => {
    setModalDraftSegments((segments) => segments.filter((_, i) => i !== index));
  }, []);

  const refreshSearchPermissions = useCallback(async () => {
    if (!userId) return;
    invalidateSearchPermissions(userId, cacheTenantId);
    const resolved = await resolveSearchFieldPermissions();
    setPermissions(resolved);
    setCachedSearchPermissions(userId, cacheTenantId, resolved);
  }, [userId, cacheTenantId]);

  const runAppliedFilter = useCallback(
    async (query: string, activeScope: FilterScope) => {
      if (!permissions) return;

      const trimmed = query.trim();
      if (!trimmed) {
        setCompileResult(null);
        setFilteredItemIds(null);
        setActiveSavedView(null);
        setModuleFilterRevision((value) => value + 1);
        return;
      }

      const fieldDict = buildFieldDict(activeScope, permissions);
      const compiled = compileFilterQuery(trimmed, activeScope, fieldDict);
      setCompileResult(compiled);
      setActiveSavedView((previous) => {
        if (!previous) return previous;
        if (
          normalizeSavedViewQuery(trimmed) !== normalizeSavedViewQuery(previous.raw_search_text)
        ) {
          return previous;
        }
        return {
          ...previous,
          raw_search_text: trimmed,
          compiled_ast: extractStructuralAst(compiled.ast),
        };
      });

      const structuralClauses = compiled.ast.filter((clause) => clause.kind !== "text");
      if (structuralClauses.length > 0) {
        const validation = validateFilterAst(compiled.ast, activeScope, permissions);
        if (!validation.ok) {
          toast.error(
            validation.error === "FORBIDDEN_FIELD"
              ? "Filter uses fields you are not permitted to access."
              : "Unable to apply native filter."
          );
          setFilteredItemIds(null);
          setModuleFilterRevision((value) => value + 1);
          return;
        }
      }

      void logSearchTelemetry({
        scope: activeScope,
        rawQuery: trimmed,
        unparsedTokens: compiled.unparsedTokens,
        ast: compiled.ast,
        compileMicros: compiled.compileMicros,
        securityFlag: scanQueryForSecuritySignatures(
          trimmed,
          userId ? `${cacheTenantId}:${userId}` : undefined
        ).flagged,
      });

      const security = scanQueryForSecuritySignatures(
        trimmed,
        userId ? `${cacheTenantId}:${userId}` : undefined
      );
      if (security.flagged && userId) {
        setThrottledSearch(userId, cacheTenantId, true);
        setPermissions((current) => (current ? { ...current, throttled: true } : current));
      }

      if (activeScope !== "items") {
        setFilteredItemIds(null);
        setModuleFilterRevision((value) => value + 1);
        return;
      }

      const structural = compiled.ast.some((clause) => clause.kind !== "text");
      const textOnly = !structural && compiled.residualText.trim().length > 0;

      if (!structural && !textOnly) {
        setFilteredItemIds(null);
        setModuleFilterRevision((value) => value + 1);
        return;
      }

      setIsExecuting(true);
      try {
        const result = await executeModuleFilter(activeScope, compiled.ast, trimmed);
        if (!result.ok) {
          setFilteredItemIds(null);
          if (result.throttled && userId) {
            setThrottledSearch(userId, cacheTenantId, true);
            setPermissions((current) =>
              current ? { ...current, throttled: true } : current
            );
            setCachedSearchPermissions(userId, cacheTenantId, {
              ...(permissions ?? { financialVisible: false, allowedFields: [], throttled: true }),
              throttled: true,
            });
          }
          toast.error(result.error ?? "Unable to apply native filter.");
          return;
        }
        setFilteredItemIds(new Set(result.itemIds));
      } finally {
        setIsExecuting(false);
        setModuleFilterRevision((value) => value + 1);
      }
    },
    [permissions, userId, cacheTenantId]
  );

  const loadSavedView = useCallback(
    (view: CustomModuleView) => {
      const viewScope = view.module_name as FilterScope;
      if (!isSavedViewsScope(viewScope)) return;

      if (scope !== viewScope) {
        setScopePinnedToAll(false);
        setScopeState(viewScope);
      }

      const snapshot: SavedViewSnapshot = {
        id: view.id,
        module_name: view.module_name,
        view_name: view.view_name,
        raw_search_text: view.raw_search_text,
        compiled_ast: view.compiled_ast,
      };

      setActiveSavedView(snapshot);
      setRawQuery("");
      setAppliedQuery(view.raw_search_text);
      void runAppliedFilter(view.raw_search_text, viewScope);
    },
    [scope, runAppliedFilter]
  );

  const loadSavedViewAndEdit = useCallback(
    (view: CustomModuleView) => {
      setOpenPaletteAfterViewLoad(true);
      loadSavedView(view);
    },
    [loadSavedView]
  );

  const editActiveViewCriteria = useCallback(() => {
    openCommandPalette();
  }, [openCommandPalette]);

  useEffect(() => {
    if (!openPaletteAfterViewLoad || !compileResult || !activeSavedView) return;
    if (
      normalizeSavedViewQuery(appliedQuery) !==
      normalizeSavedViewQuery(activeSavedView.raw_search_text)
    ) {
      return;
    }

    setOpenPaletteAfterViewLoad(false);
    openCommandPalette();
  }, [openPaletteAfterViewLoad, compileResult, appliedQuery, activeSavedView, openCommandPalette]);

  useEffect(() => {
    if (!permissions || !isSavedViewsScope(scope)) return;
    if (defaultLoadedForScopeRef.current.has(scope)) return;
    if (appliedQuery.trim().length > 0) return;

    const moduleDef = getModuleViewDefinition(scope);
    if (!moduleDef) return;

    defaultLoadedForScopeRef.current.add(scope);

    void getDefaultCustomModuleView(moduleDef.moduleName).then((result) => {
      if (!result.ok) return;
      if (result.view) {
        loadSavedView(result.view);
      }
    });
  }, [scope, permissions, appliedQuery, loadSavedView]);

  const applyModalFilters = useCallback(() => {
    if (!permissions) return;
    const fieldDict = buildFieldDict(scope, permissions);
    const segments = modalDraftSegments.filter((segment) =>
      isDraftReadyFilterClause(segment, fieldDict)
    );
    const pending = rawQuery.trim();
    if (pending && isDraftReadyFilterClause(pending, fieldDict)) {
      segments.push(pending);
    }

    const nextQuery = segments.join(" and ");
    setRawQuery("");
    setModalDraftSegments([]);
    setCommandOpen(false);

    if (!nextQuery) {
      setAppliedQuery("");
      setCompileResult(null);
      setFilteredItemIds(null);
      setActiveSavedView(null);
      setModuleFilterRevision((value) => value + 1);
      return;
    }

    setAppliedQuery(nextQuery);
    void runAppliedFilter(nextQuery, scope);
  }, [modalDraftSegments, rawQuery, scope, runAppliedFilter, permissions]);

  const submitFilter = useCallback(() => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return;

    const nextQuery = appliedQuery.trim()
      ? `${appliedQuery.trim()} and ${trimmed}`
      : trimmed;

    setAppliedQuery(nextQuery);
    setRawQuery("");
    void runAppliedFilter(nextQuery, scope);
  }, [rawQuery, appliedQuery, scope, runAppliedFilter]);

  const removeClauseAt = useCallback(
    (index: number) => {
      if (!compileResult) return;

      const segments = [...compileResult.clauseSegments];
      if (index < 0 || index >= segments.length) return;

      segments.splice(index, 1);
      const textClause = compileResult.ast.find((clause) => clause.kind === "text");
      let nextQuery = segments.join(" and ");
      if (textClause?.kind === "text" && textClause.value.trim()) {
        nextQuery = nextQuery
          ? `${nextQuery} ${textClause.value.trim()}`
          : textClause.value.trim();
      }

      setRawQuery("");
      setAppliedQuery(nextQuery);
      if (!nextQuery.trim()) {
        setActiveSavedView(null);
      }
      void runAppliedFilter(nextQuery, scope);
    },
    [compileResult, scope, runAppliedFilter]
  );

  const hasPendingFilter = rawQuery.trim().length > 0;

  const activeAst = compileResult?.ast ?? [];
  const activeFilterCount = activeAst.filter((clause) => clause.kind !== "text").length;
  const hasActiveFilters = activeFilterCount > 0 || appliedQuery.trim().length > 0;
  const savedViewDirty = isSavedViewDirty(activeSavedView, appliedQuery, activeAst);

  const modalDraftCompile = useMemo(() => {
    if (!permissions || modalDraftSegments.length === 0) return null;
    const fieldDict = buildFieldDict(scope, permissions);
    return compileFilterQuery(modalDraftSegments.join(" and "), scope, fieldDict);
  }, [modalDraftSegments, permissions, scope]);

  const modalDraftAst = modalDraftCompile?.ast ?? [];

  const fieldDict = useMemo(() => {
    if (!permissions) return [];
    return buildFieldDict(scope, permissions);
  }, [permissions, scope]);

  const canApplyModal = useMemo(() => {
    if (!fieldDict.length) return false;
    const pending = rawQuery.trim();
    if (pending && isDraftReadyFilterClause(pending, fieldDict)) return true;
    return modalDraftSegments.some((segment) => isDraftReadyFilterClause(segment, fieldDict));
  }, [fieldDict, rawQuery, modalDraftSegments]);

  const value = useMemo<OmnibarContextValue>(
    () => ({
      rawQuery,
      setRawQuery,
      appliedQuery,
      submitFilter,
      hasPendingFilter,
      scope,
      setScope,
      scopePinnedToAll,
      placeholder: getScopePlaceholder(scope),
      scopeOptions: Object.values(SCOPE_DEFINITIONS),
      compileResult,
      activeAst,
      residualText: compileResult?.residualText ?? "",
      filteredItemIds,
      permissions,
      clearFilters,
      removeClauseAt,
      hasActiveFilters,
      activeFilterCount,
      commandOpen,
      setCommandOpen,
      openCommandPalette,
      closeCommandPalette,
      cancelCommandPalette,
      modalDraftAst,
      addDraftCriterion,
      removeDraftCriterionAt,
      clearModalDraft,
      applyModalFilters,
      canApplyModal,
      inputRef,
      focusInput,
      isExecuting,
      moduleFilterRevision,
      refreshSearchPermissions,
      activeSavedViewId: activeSavedView?.id ?? null,
      activeSavedView,
      isSavedViewDirty: savedViewDirty,
      loadSavedView,
      loadSavedViewAndEdit,
      editActiveViewCriteria,
      clearActiveSavedView,
      setActiveSavedViewSnapshot,
      notifySavedViewsChanged,
      savedViewsRevision,
    }),
    [
      rawQuery,
      appliedQuery,
      submitFilter,
      hasPendingFilter,
      scope,
      setScope,
      scopePinnedToAll,
      compileResult,
      activeAst,
      filteredItemIds,
      permissions,
      clearFilters,
      removeClauseAt,
      hasActiveFilters,
      activeFilterCount,
      commandOpen,
      openCommandPalette,
      closeCommandPalette,
      cancelCommandPalette,
      modalDraftAst,
      addDraftCriterion,
      removeDraftCriterionAt,
      clearModalDraft,
      applyModalFilters,
      canApplyModal,
      focusInput,
      isExecuting,
      moduleFilterRevision,
      refreshSearchPermissions,
      activeSavedView,
      savedViewDirty,
      loadSavedView,
      loadSavedViewAndEdit,
      editActiveViewCriteria,
      clearActiveSavedView,
      setActiveSavedViewSnapshot,
      notifySavedViewsChanged,
      savedViewsRevision,
    ]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        if (!commandOpen) openCommandPalette();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [commandOpen, openCommandPalette]);

  return <OmnibarContext.Provider value={value}>{children}</OmnibarContext.Provider>;
}

export function useOmnibarContext(): OmnibarContextValue {
  const context = useContext(OmnibarContext);
  if (!context) {
    throw new Error("useOmnibarContext must be used within OmnibarProvider");
  }
  return context;
}

export function useOptionalOmnibarContext(): OmnibarContextValue | null {
  return useContext(OmnibarContext);
}
