"use client";

import { Search, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listFilterValueOptions } from "@/app/search/actions";
import { HintDrawer } from "@/components/search/hint-drawer";
import { OmnibarScopeSelect } from "@/components/search/omnibar-scope-select";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { buildFieldDict } from "@/lib/search/permissions/resolve-field-dict";
import {
  analyzeActiveSegment,
  applyHintToQuery,
  buildOmnibarHints,
  getHintPhaseTitle,
} from "@/lib/search/hints/build-hints";
import {
  getCachedValueOptions,
  getStaticValueOptions,
  setCachedValueOptions,
} from "@/lib/search/value-option-cache";
import { getRecentSearches } from "@/lib/search/recent-searches";
import type { FilterValueOption, OmnibarHint } from "@/lib/search/types";
import { cn } from "@/lib/utils";

const VALUE_OPTION_DEBOUNCE_MS = 150;
const LIVE_PREVIEW_DEBOUNCE_MS = 300;

type Props = {
  className?: string;
  mobile?: boolean;
  variant?: "inline" | "dialog";
};

export function Omnibar({
  className,
  mobile = false,
  variant = "inline",
}: Props) {
  const router = useRouter();
  const {
    rawQuery,
    setRawQuery,
    placeholder,
    scope,
    setScope,
    scopeOptions,
    inputRef,
    submitFilter,
    addDraftCriterion,
    hasPendingFilter,
    filterError,
    permissions,
    recentSearchesRevision,
    applyQueryDirect,
    setInlinePreview,
  } = useOmnibarContext();

  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [activeHintIndex, setActiveHintIndex] = useState(0);
  const [hasNavigatedHint, setHasNavigatedHint] = useState(false);
  const [valueOptions, setValueOptions] = useState<FilterValueOption[]>([]);
  const [valueOptionsLoading, setValueOptionsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const supportsRecent = scope !== "all" && scope !== "settings";

  useEffect(() => {
    if (!focused || !supportsRecent) return;
    setRecentSearches(getRecentSearches(scope));
  }, [focused, scope, supportsRecent, recentSearchesRevision]);

  useEffect(() => {
    if (variant !== "inline") return;
    const handle = window.setTimeout(() => {
      setInlinePreview(rawQuery);
    }, LIVE_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [rawQuery, variant, setInlinePreview]);

  const fieldDict = useMemo(() => {
    if (!permissions) return [];
    return buildFieldDict(scope, permissions);
  }, [permissions, scope]);

  const segmentAnalysis = useMemo(() => {
    if (!permissions) return { phase: "field" as const };
    return analyzeActiveSegment(rawQuery, cursor, fieldDict, valueOptions);
  }, [permissions, rawQuery, cursor, fieldDict, valueOptions]);

  useEffect(() => {
    const fieldKey = segmentAnalysis.fieldKey;
    if (!focused || segmentAnalysis.phase !== "value" || !fieldKey) {
      setValueOptions([]);
      setValueOptionsLoading(false);
      return;
    }

    const staticOptions = getStaticValueOptions(scope, fieldKey);
    if (staticOptions) {
      setValueOptions(staticOptions);
      setValueOptionsLoading(false);
      return;
    }

    const cached = getCachedValueOptions(scope, fieldKey);
    if (cached) {
      setValueOptions(cached);
      setValueOptionsLoading(false);
      return;
    }

    let cancelled = false;
    setValueOptionsLoading(true);
    const timer = window.setTimeout(() => {
      void listFilterValueOptions(scope, fieldKey).then((result) => {
        if (cancelled) return;
        const options = result.ok ? result.options : [];
        if (result.ok) setCachedValueOptions(scope, fieldKey, options);
        setValueOptions(options);
        setValueOptionsLoading(false);
      });
    }, VALUE_OPTION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [focused, scope, segmentAnalysis.fieldKey, segmentAnalysis.phase]);

  const showRecent =
    variant === "inline" &&
    focused &&
    supportsRecent &&
    rawQuery.trim().length === 0 &&
    recentSearches.length > 0;

  const hintItems = useMemo(() => {
    if (!focused || !permissions) return [];
    if (showRecent) {
      return recentSearches.map<OmnibarHint>((query) => ({
        label: query,
        insertText: query,
        kind: "recent",
        query,
      }));
    }
    return buildOmnibarHints(rawQuery, cursor, scope, fieldDict, {
      valueOptions,
      analysis: segmentAnalysis,
    });
  }, [
    focused,
    permissions,
    showRecent,
    recentSearches,
    rawQuery,
    cursor,
    scope,
    fieldDict,
    valueOptions,
    segmentAnalysis,
  ]);

  const inValuePhase = focused && !showRecent && segmentAnalysis.phase === "value";
  const showValueLoading = inValuePhase && valueOptionsLoading;
  const showValueEmpty = inValuePhase && !valueOptionsLoading && hintItems.length === 0;
  const showHints = focused && hintItems.length > 0;
  const showDrawer = showHints || showValueLoading || showValueEmpty;

  useEffect(() => {
    if (activeHintIndex >= hintItems.length) {
      setActiveHintIndex(Math.max(0, hintItems.length - 1));
    }
  }, [activeHintIndex, hintItems.length]);

  const applyHint = useCallback(
    (hint: OmnibarHint) => {
      if (hint.kind === "navigation" && hint.href) {
        router.push(hint.href);
        setFocused(false);
        return;
      }

      if (hint.kind === "recent" && hint.query) {
        applyQueryDirect(hint.query);
        setFocused(false);
        return;
      }

      const { nextQuery, nextCursor } = applyHintToQuery(rawQuery, cursor, hint, fieldDict);
      setRawQuery(nextQuery);
      setCursor(nextCursor);
      setActiveHintIndex(0);
      setHasNavigatedHint(false);
      window.requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [applyQueryDirect, cursor, fieldDict, inputRef, rawQuery, router, setRawQuery]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const highlightedHint = showHints ? hintItems[activeHintIndex] : undefined;

    if (showHints && hintItems.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveHintIndex((value) => (value + 1) % hintItems.length);
        setHasNavigatedHint(true);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveHintIndex((value) => (value - 1 + hintItems.length) % hintItems.length);
        setHasNavigatedHint(true);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        applyHint(hintItems[activeHintIndex]!);
        return;
      }
    }

    if (event.key !== "Enter") return;
    event.preventDefault();

    // If the user explicitly navigated to a hint (e.g. an AND/OR connector),
    // Enter applies that hint instead of committing/submitting.
    if (hasNavigatedHint && highlightedHint) {
      applyHint(highlightedHint);
      return;
    }

    if (variant === "dialog") {
      // Commit the current input as one or more chips (compound queries are split
      // into a chip per clause). Fall back to applying the top hint when nothing
      // is committable yet (i.e. an incomplete clause being autocompleted).
      if (addDraftCriterion()) return;
      if (highlightedHint) applyHint(highlightedHint);
      return;
    }

    // Inline variant: Enter on an empty box applies a highlighted recent search;
    // otherwise it submits the current query (which handles compound clauses).
    if (rawQuery.trim().length === 0 && highlightedHint) {
      applyHint(highlightedHint);
      return;
    }
    submitFilter();
  };

  const hintTitle = showRecent
    ? "Recent searches"
    : getHintPhaseTitle(segmentAnalysis.phase, scope);

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 shadow-sm backdrop-blur-md transition-all duration-200 dark:shadow-glow-sm",
          mobile ? "h-11" : "h-10",
          focused && "border-primary/40 ring-2 ring-primary/20",
          hasPendingFilter && "border-amber-500/40",
          filterError && "border-destructive/60 ring-2 ring-destructive/20"
        )}
      >
        <OmnibarScopeSelect scope={scope} options={scopeOptions} onScopeChange={setScope} />
        <Search className="h-4 w-4 shrink-0 text-primary/70" />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={rawQuery}
          onChange={(event) => {
            setRawQuery(event.target.value);
            setCursor(event.target.selectionStart ?? event.target.value.length);
            setActiveHintIndex(0);
            setHasNavigatedHint(false);
          }}
          onSelect={(event) => {
            setCursor(event.currentTarget.selectionStart ?? rawQuery.length);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Context-aware search and filter"
          aria-invalid={filterError ? true : undefined}
          aria-expanded={showDrawer}
          aria-haspopup="listbox"
          aria-controls={showHints ? "omnibar-hint-listbox" : undefined}
          aria-activedescendant={
            showHints ? `omnibar-hint-option-${activeHintIndex}` : undefined
          }
          role="combobox"
        />
        {rawQuery ? (
          <button
            type="button"
            onClick={() => setRawQuery("")}
            className="rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:text-foreground"
            aria-label="Clear input"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Sparkles className="hidden h-3.5 w-3.5 text-primary/60 lg:block" />
        )}
      </div>

      {showDrawer ? (
        <HintDrawer
          hints={hintItems}
          activeIndex={activeHintIndex}
          onSelect={applyHint}
          onHighlight={setActiveHintIndex}
          title={hintTitle}
          loading={showValueLoading}
          emptyMessage={showValueEmpty ? "Type a value, then press Enter" : undefined}
          placement={variant === "dialog" ? "stacked" : "dropdown"}
        />
      ) : null}

      {filterError ? (
        <p className="mt-1 text-[11px] text-destructive" role="alert">
          {filterError}
        </p>
      ) : variant === "dialog" ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Tab autocompletes · AND/OR to extend · Enter adds criterion · Ctrl+Enter to apply
        </p>
      ) : null}
    </div>
  );
}
