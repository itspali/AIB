"use client";

import { Command, Search } from "lucide-react";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { getScopeTriggerLabel } from "@/lib/search/scopes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function OmnibarSearchTrigger({ className }: Props) {
  const { scope, commandOpen, activeFilterCount, openCommandPalette } = useOmnibarContext();

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={cn(
        "flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-card/60 px-3 text-sm text-muted-foreground shadow-sm backdrop-blur-md transition-all duration-200 hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:shadow-glow-sm",
        commandOpen && "border-primary/40 ring-2 ring-primary/20",
        className
      )}
      aria-label="Open search and filter"
    >
      <Search className="h-4 w-4 shrink-0 text-primary/70" />
      <span className="min-w-0 flex-1 truncate text-left">{getScopeTriggerLabel(scope)}</span>
      {activeFilterCount > 0 ? (
        <Badge variant="default" className="shrink-0 text-[10px] tabular-nums">
          {activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"}
        </Badge>
      ) : null}
      <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium lg:inline-flex">
        <Command className="h-3 w-3" />K
      </kbd>
    </button>
  );
}
