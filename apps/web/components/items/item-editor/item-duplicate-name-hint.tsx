"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import type { SimilarItem } from "@/app/items/actions";
import { Spinner } from "@/components/ui/spinner";
import { useEditorPanelLayout } from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

type Props = {
  similarItems: SimilarItem[];
  loading: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
};

export function ItemDuplicateNameHint({
  similarItems,
  loading,
  expanded,
  onToggleExpanded,
}: Props) {
  const panel = useEditorPanelLayout();

  if (!loading && similarItems.length === 0) {
    return null;
  }

  const count = similarItems.length;
  const countLabel =
    count === 1 ? "1 similar item in your workspace" : `${count} similar items in your workspace`;

  return (
    <div
      className={cn("mt-1.5 space-y-1.5", panel ? "text-xs" : "text-sm")}
      role="status"
      aria-live="polite"
      aria-busy={loading}
    >
      {loading && count === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner className={panel ? "size-3.5" : "size-4"} label="Checking for similar items" />
          <span className="text-xs">Checking your catalog…</span>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onToggleExpanded}
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium text-amber-800 transition-colors dark:text-amber-300",
              "hover:text-amber-900 dark:hover:text-amber-200"
            )}
          >
            {countLabel}
            {expanded ? (
              <ChevronUp className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5 shrink-0" aria-hidden />
            )}
            <span className="sr-only">{expanded ? "Hide matches" : "Show matches"}</span>
          </button>

          {expanded ? (
            <ul className={cn("space-y-0.5 rounded-md border border-border/50 bg-muted/10 p-1.5")}>
              {similarItems.map((match) => (
                <li key={match.id}>
                  <Link
                    href={`/items/${match.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    prefetch={false}
                    className={cn(
                      "group flex items-center justify-between gap-3 rounded-md px-2 py-1 transition-colors",
                      "hover:bg-background/70 dark:hover:bg-background/20"
                    )}
                  >
                    <span className="min-w-0 truncate text-foreground">
                      {match.name}
                      {match.code ? (
                        <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                          {match.code}
                        </span>
                      ) : null}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary opacity-80 group-hover:opacity-100">
                      View
                      <ArrowUpRight className="size-3" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
