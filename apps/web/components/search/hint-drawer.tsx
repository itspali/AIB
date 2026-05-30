"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import type { OmnibarHint } from "@/lib/search/types";
import { cn } from "@/lib/utils";

export type OmnibarHintDrawerProps = {
  hints: OmnibarHint[];
  activeIndex: number;
  onSelect: (hint: OmnibarHint) => void;
  onHighlight?: (index: number) => void;
  title?: string;
  loading?: boolean;
  emptyMessage?: string;
};

type Props = OmnibarHintDrawerProps & {
  placement?: "dropdown" | "stacked" | "panel";
  panelContainer?: HTMLElement | null;
};

export function HintDrawer({
  hints,
  activeIndex,
  onSelect,
  onHighlight,
  title = "Suggestions",
  loading = false,
  emptyMessage,
  placement = "dropdown",
  panelContainer = null,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(`[data-hint-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, hints]);

  const shellClassName = cn(
    "overflow-hidden bg-card/95 backdrop-blur-xl",
    placement === "dropdown" &&
      "absolute left-0 right-0 top-full z-[60] mt-1 rounded-xl border border-border p-2 shadow-lg",
    placement === "stacked" &&
      "relative z-[60] mt-1 rounded-xl border border-border p-2 shadow-lg",
    placement === "panel" &&
      "shrink-0 border-t border-border/60 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)]"
  );

  const renderShell = (body: ReactNode) => {
    const node = <div className={shellClassName}>{body}</div>;
    if (placement === "panel") {
      if (panelContainer) return createPortal(node, panelContainer);
      return node;
    }
    return node;
  };

  if (loading) {
    return renderShell(
      <>
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading suggestions…
        </div>
      </>
    );
  }

  if (hints.length === 0) {
    if (!emptyMessage) return null;
    return renderShell(
      <>
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyMessage}</p>
      </>
    );
  }

  return renderShell(
    <>
      <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul
        ref={listRef}
        id="omnibar-hint-listbox"
        className={cn(
          "space-y-0.5 overflow-y-auto",
          placement === "dropdown" || placement === "stacked" ? "max-h-48" : "max-h-40"
        )}
        role="listbox"
      >
        {hints.map((hint, index) => (
          <li
            key={`${hint.kind}-${hint.label}-${index}`}
            id={`omnibar-hint-option-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            data-hint-index={index}
          >
            <button
              type="button"
              className={cn(
                "flex w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground",
                index === activeIndex && "bg-accent text-foreground"
              )}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => onHighlight?.(index)}
              onClick={() => onSelect(hint)}
            >
              {hint.kind === "navigation" ? (
                <>
                  Go to <span className="font-medium text-foreground">{hint.label}</span>
                </>
              ) : hint.kind === "operator" ? (
                <>
                  Operator: <span className="font-medium text-foreground">{hint.label}</span>
                </>
              ) : hint.kind === "value" ? (
                <>
                  Value: <span className="font-medium text-foreground">{hint.label}</span>
                </>
              ) : hint.kind === "recent" ? (
                <span className="truncate font-medium text-foreground">{hint.label}</span>
              ) : hint.kind === "example" ? (
                <>
                  Example: <span className="font-medium text-foreground">{hint.label}</span>
                </>
              ) : (
                <span className="font-medium text-foreground">{hint.label}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
