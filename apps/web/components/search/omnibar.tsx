"use client";

import { Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HintDrawer } from "@/components/search/hint-drawer";
import { OmnibarScopeSelect } from "@/components/search/omnibar-scope-select";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { buildFieldDict } from "@/lib/search/permissions/resolve-field-dict";
import { isDraftReadyFilterClause } from "@/lib/search/compiler/parser";
import { applyHintToQuery, buildOmnibarHints } from "@/lib/search/hints/build-hints";
import type { OmnibarHint } from "@/lib/search/types";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  mobile?: boolean;
  variant?: "inline" | "dialog";
};

export function Omnibar({ className, mobile = false, variant = "inline" }: Props) {
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
    permissions,
  } = useOmnibarContext();

  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [activeHintIndex, setActiveHintIndex] = useState(0);

  const fieldDict = useMemo(() => {
    if (!permissions) return [];
    return buildFieldDict(scope, permissions);
  }, [permissions, scope]);

  const hintItems = useMemo(() => {
    if (!focused || !permissions) return [];
    return buildOmnibarHints(rawQuery, cursor, scope, fieldDict);
  }, [focused, permissions, rawQuery, cursor, scope, fieldDict]);

  const showHints = focused && hintItems.length > 0;

  useEffect(() => {
    if (activeHintIndex >= hintItems.length) {
      setActiveHintIndex(Math.max(0, hintItems.length - 1));
    }
  }, [activeHintIndex, hintItems.length]);

  const applyHint = (hint: OmnibarHint) => {
    if (hint.kind === "navigation" && hint.href) {
      router.push(hint.href);
      setFocused(false);
      return;
    }

    const { nextQuery, nextCursor } = applyHintToQuery(rawQuery, cursor, hint);
    setRawQuery(nextQuery);
    setCursor(nextCursor);
    setActiveHintIndex(0);
    window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (showHints && hintItems.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveHintIndex((value) => (value + 1) % hintItems.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveHintIndex((value) => (value - 1 + hintItems.length) % hintItems.length);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        applyHint(hintItems[activeHintIndex]!);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const trimmed = rawQuery.trim();
        const shouldAddDraft =
          variant === "dialog" &&
          trimmed.length > 0 &&
          isDraftReadyFilterClause(trimmed, fieldDict);
        if (shouldAddDraft) {
          addDraftCriterion();
          return;
        }
        applyHint(hintItems[activeHintIndex]!);
        return;
      }
      return;
    }

    if (event.key !== "Enter") return;
    event.preventDefault();
    if (variant === "dialog") {
      const trimmed = rawQuery.trim();
      if (trimmed && isDraftReadyFilterClause(trimmed, fieldDict)) {
        addDraftCriterion();
      }
      return;
    }
    submitFilter();
  };

  const hintTitle =
    scope === "all" ? "Navigation" : scope === "settings" ? "Suggestions" : "Native filter hints";

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 shadow-sm backdrop-blur-md transition-all duration-200 dark:shadow-glow-sm",
          mobile ? "h-11" : "h-10",
          focused && "border-primary/40 ring-2 ring-primary/20",
          hasPendingFilter && "border-amber-500/40"
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
          aria-expanded={showHints}
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

      {variant === "dialog" ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          ↑↓ suggestions · Enter adds a complete filter · Tab inserts suggestion · Ctrl+Enter to apply
        </p>
      ) : null}

      {showHints ? (
        <HintDrawer
          hints={hintItems}
          activeIndex={activeHintIndex}
          onSelect={applyHint}
          onHighlight={setActiveHintIndex}
          title={hintTitle}
        />
      ) : null}
    </div>
  );
}
