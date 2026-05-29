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

const DEBOUNCE_MS = 150;

type OmnibarContextValue = {
  rawQuery: string;
  setRawQuery: (value: string) => void;
  debouncedQuery: string;
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
  const [debouncedQuery, setDebouncedQuery] = useState("");
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(rawQuery), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [rawQuery]);

  const setScope = useCallback(
    (nextScope: FilterScope) => {
      if (nextScope === "all") {
        setScopePinnedToAll(true);
        setRawQuery("");
        setDebouncedQuery("");
        setCompileResult(null);
        setFilteredItemIds(null);
        setModuleFilterRevision((value) => value + 1);
      } else {
        setScopePinnedToAll(false);
        setScopeState(nextScope);
      }
    },
    []
  );

  const clearFilters = useCallback(() => {
    setRawQuery("");
    setDebouncedQuery("");
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

  useEffect(() => {
    if (!permissions) return;

    const security = scanQueryForSecuritySignatures(
      debouncedQuery,
      userId ? `${cacheTenantId}:${userId}` : undefined
    );

    if (security.flagged && userId) {
      setThrottledSearch(userId, cacheTenantId, true);
      setPermissions((current) =>
        current ? { ...current, throttled: true } : current
      );
    }

    const fieldDict = buildFieldDict(scope, permissions);
    const compiled = compileFilterQuery(debouncedQuery, scope, fieldDict);
    setCompileResult(compiled);

    void logSearchTelemetry({
      scope,
      rawQuery: debouncedQuery,
      unparsedTokens: compiled.unparsedTokens,
      ast: compiled.ast,
      compileMicros: compiled.compileMicros,
      securityFlag: security.flagged,
    });

    if (scope !== "items" || !debouncedQuery.trim()) {
      setFilteredItemIds(null);
      return;
    }

    const structural = compiled.ast.some((clause) => clause.kind !== "text");
    if (!structural && !compiled.residualText.trim()) {
      setFilteredItemIds(null);
      return;
    }

    setIsExecuting(true);
    void executeModuleFilter(scope, compiled.ast, debouncedQuery)
      .then((result) => {
        if (!result.ok) {
          if (result.error.includes("restricted") && userId) {
            setThrottledSearch(userId, cacheTenantId, true);
            setPermissions((current) =>
              current ? { ...current, throttled: true } : current
            );
          }
          setFilteredItemIds(new Set());
          return;
        }
        setFilteredItemIds(new Set(result.itemIds));
      })
      .finally(() => setIsExecuting(false));
  }, [debouncedQuery, scope, permissions, userId, cacheTenantId]);

  const fieldHints = useMemo(() => {
    if (!permissions) return [];
    return buildFieldDict(scope, permissions).flatMap((entry) => entry.synonyms);
  }, [permissions, scope]);

  const navigationMatches = useMemo(() => {
    if (scope !== "all") return [];
    return matchNavigationIndex(debouncedQuery);
  }, [scope, debouncedQuery]);

  const value = useMemo<OmnibarContextValue>(
    () => ({
      rawQuery,
      setRawQuery,
      debouncedQuery,
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
      debouncedQuery,
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
      if (event.key === "Enter" && scope === "all" && navigationMatches[0]) {
        router.push(navigationMatches[0].href);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusInput, navigationMatches, router, scope]);

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
