"use client";

import { Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { FilterChipRow } from "@/components/search/filter-chip-row";
import { HintDrawer } from "@/components/search/hint-drawer";
import { OmnibarScopeSelect } from "@/components/search/omnibar-scope-select";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  mobile?: boolean;
};

export function Omnibar({ className, mobile = false }: Props) {
  const {
    rawQuery,
    setRawQuery,
    placeholder,
    scope,
    setScope,
    scopeOptions,
    compileResult,
    clearFilters,
    inputRef,
    fieldHints,
    submitFilter,
    hasPendingFilter,
    isExecuting,
  } = useOmnibarContext();

  const [focused, setFocused] = useState(false);
  const showHints = focused && rawQuery.trim().length > 0;

  const hintItems = useMemo(() => {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return fieldHints.slice(0, 8);
    return fieldHints.filter((hint) => hint.includes(q) || q.includes(hint)).slice(0, 8);
  }, [rawQuery, fieldHints]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitFilter();
  };

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
          type="search"
          value={rawQuery}
          onChange={(event) => setRawQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Context-aware search and filter"
        />
        {rawQuery ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Sparkles className="hidden h-3.5 w-3.5 text-primary/60 lg:block" />
        )}
      </div>

      {scope === "items" && (hasPendingFilter || isExecuting) ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {isExecuting ? "Applying filter…" : "Press Enter to apply native filter"}
        </p>
      ) : null}

      {compileResult?.ast.length ? (
        <FilterChipRow ast={compileResult.ast} className="mt-2" />
      ) : null}

      {showHints && hintItems.length > 0 && scope !== "all" ? (
        <HintDrawer hints={hintItems} />
      ) : null}
    </div>
  );
}
