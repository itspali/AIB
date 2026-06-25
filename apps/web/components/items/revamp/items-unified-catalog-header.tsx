"use client";

import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemsCatalogHeaderMobileMenu } from "@/components/items/revamp/items-catalog-header-mobile-menu";
import {
  ItemsListDataTransferMenu,
  type ItemsListDataTransferMenuProps,
} from "@/components/items/items-list-data-transfer-menu";
import {
  LIST_TOOLBAR_CONTROL_HEIGHT,
  LIST_TOOLBAR_TEXT,
} from "@/lib/layout/list-toolbar-chrome";
import { useViewportMatches } from "@/lib/layout/use-viewport-matches";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const CATALOG_MOBILE_TOOLBAR_MEDIA = "(max-width: 900px)";

type FeedFilterProps = {
  value: string;
  onChange: (value: string) => void;
};

type Props = {
  onNewItem: () => void;
  count: ReactNode;
  controls: ReactNode;
  feedFilter?: FeedFilterProps;
  dataTransferMenuProps?: Omit<ItemsListDataTransferMenuProps, "variant">;
  /** Split layout — search spans the list pane width (380px). */
  layout?: "split" | "matrix";
};

/** Items catalog header — single row: title/count/filter rail + toolbar strip + actions. */
export function ItemsUnifiedCatalogHeader({
  onNewItem,
  count,
  controls,
  feedFilter,
  dataTransferMenuProps,
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
        placeholder="Filter records…"
        aria-label="Filter catalog records"
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

  const newItemButton = (
    <Button
      type="button"
      size="sm"
      className="h-8 w-8 shrink-0 px-0"
      onClick={onNewItem}
      aria-label="New item"
      title="New item"
    >
      <Plus className="h-4 w-4" aria-hidden />
    </Button>
  );

  const desktopDataTransfer = dataTransferMenuProps ? (
    <ItemsListDataTransferMenu {...dataTransferMenuProps} />
  ) : null;

  const mobileDataTransfer = dataTransferMenuProps ? (
    <ItemsListDataTransferMenu {...dataTransferMenuProps} variant="embedded" />
  ) : null;

  const mobileToolbarMenu = (
    <ItemsCatalogHeaderMobileMenu controls={controls} dataTransfer={mobileDataTransfer} />
  );

  const desktopToolbarRow = (
    <div
      className={cn(
        "revamp-catalog-toolbar revamp-catalog-toolbar--strip flex min-h-9 min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible md:gap-2.5",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      {controls}
    </div>
  );

  if (isMobileToolbar) {
    return (
      <div
        className={cn(
          "items-unified-catalog-header items-unified-catalog-header--split items-unified-catalog-header--split-mobile",
          layout === "matrix" && "items-unified-catalog-header--matrix"
        )}
      >
        <h1 className="shrink-0 text-base font-bold tracking-tight">Items</h1>
        <div className="shrink-0 text-sm tabular-nums text-muted-foreground">{count}</div>
        {searchField}
        {mobileToolbarMenu}
        {newItemButton}
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
        <h1 className="shrink-0 text-lg font-bold tracking-tight md:text-xl">Items</h1>
        <div className="shrink-0 text-sm tabular-nums text-muted-foreground">{count}</div>
        {searchField}
      </div>
      <div className="items-unified-catalog-header__global-actions">
        {desktopToolbarRow}
        {desktopDataTransfer}
        {newItemButton}
      </div>
    </div>
  );
}
