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
import { compileFilterQuery } from "@/lib/search/compiler/compile";
import { buildFieldDict } from "@/lib/search/permissions/resolve-field-dict";
import {
  getCachedSearchPermissions,
  invalidateSearchPermissions,
  setCachedSearchPermissions,
  setThrottledSearch,
} from "@/lib/search/permissions/session-cache";
import { scanQueryForSecuritySignatures } from "@/lib/search/telemetry/signatures";
import { matchNavigationIndex } from "@/lib/search/navigation-index";
import {
  getScopePlaceholder,
  resolveScopeFromPath,
  type ScopeDefinition,
  SCOPE_DEFINITIONS,
} from "@/lib/search/scopes";
import type {
  AstClause,
  CompileResult,
  FilterScope,
  NavigationIndexEntry,
  SearchFieldPermissions,
} from "@/lib/search/types";
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
  fieldHints: string[];
  navigationMatches: NavigationIndexEntry[];
  clearFilters: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  focusInput: () => void;
  isExecuting: boolean;
  moduleFilterRevision: number;
  refreshSearchPermissions: () => Promise<void>;
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
    setScopeState(resolveScopeFromPath(pathname));
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
        setModuleFilterRevision((value) => value + 1);
        return;
      }

      setScopePinnedToAll(false);
      setScopeState(nextScope);
    },
    [scope]
  );

  const clearFilters = useCallback(() => {
    setRawQuery("");
    setAppliedQuery("");
    setCompileResult(null);
    setFilteredItemIds(null);
    setModuleFilterRevision((value) => value + 1);
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
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
        setModuleFilterRevision((value) => value + 1);
        return;
      }

      const fieldDict = buildFieldDict(activeScope, permissions);
      const compiled = compileFilterQuery(trimmed, activeScope, fieldDict);
      setCompileResult(compiled);

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

  const submitFilter = useCallback(() => {
    const trimmed = rawQuery.trim();
    setAppliedQuery(trimmed);
    void runAppliedFilter(trimmed, scope);
  }, [rawQuery, scope, runAppliedFilter]);

  const hasPendingFilter = rawQuery.trim() !== appliedQuery.trim();

  const fieldHints = useMemo(() => {
    if (!permissions) return [];
    return buildFieldDict(scope, permissions).flatMap((entry) => entry.synonyms);
  }, [permissions, scope]);

  const navigationMatches = useMemo(() => {
    if (scope !== "all") return [];
    return matchNavigationIndex(appliedQuery || rawQuery);
  }, [scope, appliedQuery, rawQuery]);

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
      activeAst: compileResult?.ast ?? [],
      residualText: compileResult?.residualText ?? "",
      filteredItemIds,
      permissions,
      fieldHints,
      navigationMatches,
      clearFilters,
      inputRef,
      focusInput,
      isExecuting,
      moduleFilterRevision,
      refreshSearchPermissions,
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
      filteredItemIds,
      permissions,
      fieldHints,
      navigationMatches,
      clearFilters,
      focusInput,
      isExecuting,
      moduleFilterRevision,
      refreshSearchPermissions,
    ]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusInput();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusInput]);

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
