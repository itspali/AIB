"use client";

import { Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { CatalogHeaderMobileMenu } from "@/components/layout/catalog-header-mobile-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LIST_TOOLBAR_CONTROL_HEIGHT,
  LIST_TOOLBAR_TEXT,
} from "@/lib/layout/list-toolbar-chrome";
import { useViewportMatches } from "@/lib/layout/use-viewport-matches";
import { cn } from "@/lib/utils";

const CATALOG_MOBILE_TOOLBAR_MEDIA = "(max-width: 900px)";

type FeedFilterProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

type Props = {
  title: string;
  count?: ReactNode;
  controls?: ReactNode;
  onNew?: () => void;
  newAriaLabel?: string;
  feedFilter?: FeedFilterProps;
  trailingActions?: ReactNode;
  layout?: "split" | "matrix";
};

/** Shared catalog header — title/count/filter rail + toolbar strip + actions. */
export function UnifiedCatalogHeader({
  title,
  count,
  controls,
  onNew,
  newAriaLabel = "Create new record",
  feedFilter,
  trailingActions,
  layout = "matrix",
}: Props) {
  const isMobileToolbar = useViewportMatches(CATALOG_MOBILE_TOOLBAR_MEDIA);

  const searchField = feedFilter ? (
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground/55 dark:text-foreground/70"
        aria-hidden
      />
      <Input
        value={feedFilter.value}
        onChange={(event) => feedFilter.onChange(event.target.value)}
        placeholder={feedFilter.placeholder ?? "Filter records…"}
        aria-label={feedFilter.ariaLabel ?? "Filter catalog records"}
        className={cn(
          LIST_TOOLBAR_CONTROL_HEIGHT,
          LIST_TOOLBAR_TEXT,
          "w-full rounded-md border border-primary/20 bg-card/40 pl-8 shadow-none backdrop-blur-sm",
          "dark:bg-card/25",
          "hover:border-primary/25 hover:bg-card/50 dark:hover:bg-card/30",
          "focus-visible:border-primary/20 focus-visible:bg-card/50 focus-visible:outline-none",
          "focus-visible:ring-0 focus-visible:ring-offset-0 dark:focus-visible:bg-card/30"
        )}
      />
    </div>
  ) : null;

  const newButton =
    onNew != null ? (
      <Button
        type="button"
        size="sm"
        className="h-8 w-8 shrink-0 px-0"
        onClick={onNew}
        aria-label={newAriaLabel}
        title={newAriaLabel}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </Button>
    ) : null;

  const mobileToolbarMenu = controls ? (
    <CatalogHeaderMobileMenu controls={controls} />
  ) : null;

  const desktopToolbarRow = controls ? (
    <div
      className={cn(
        "revamp-catalog-toolbar revamp-catalog-toolbar--strip flex min-h-9 min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible md:gap-2.5",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      {controls}
    </div>
  ) : null;

  if (isMobileToolbar) {
    return (
      <div
        className={cn(
          "items-unified-catalog-header items-unified-catalog-header--split items-unified-catalog-header--split-mobile",
          layout === "matrix" && "items-unified-catalog-header--matrix"
        )}
      >
        <h1 className="shrink-0 text-base font-bold tracking-tight">{title}</h1>
        {count != null ? (
          <div className="shrink-0 text-sm tabular-nums text-muted-foreground">{count}</div>
        ) : null}
        {searchField}
        {mobileToolbarMenu}
        {newButton}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "items-unified-catalog-header items-unified-catalog-header--split",
        layout === "matrix" && "items-unified-catalog-header--matrix"
      )}
    >
      <div className="items-unified-catalog-header__list-rail">
        <h1 className="shrink-0 text-lg font-bold tracking-tight md:text-xl">{title}</h1>
        {count != null ? (
          <div className="shrink-0 text-sm tabular-nums text-muted-foreground">{count}</div>
        ) : null}
        {searchField}
      </div>
      <div className="items-unified-catalog-header__global-actions">
        {desktopToolbarRow}
        {trailingActions}
        {newButton}
      </div>
    </div>
  );
}
