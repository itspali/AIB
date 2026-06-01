"use client";

import { ChevronDown } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { listControlShellClassName } from "@/lib/products/list-control-shell";
import { cn } from "@/lib/utils";

export type BulkToolbarAction =
  | "pricing"
  | "jurisdiction"
  | "archive"
  | "reactivate"
  | "category"
  | "classification"
  | "taxCategory"
  | "flags"
  | "tags"
  | "storefront"
  | "export";

type ToolbarActionItem = {
  id: BulkToolbarAction;
  label: string;
  show: boolean;
  variant?: "destructive";
};

type Props = {
  selectedCount: number;
  totalMatchingCount: number;
  selectAllMatching: boolean;
  pageAllSelected: boolean;
  visibleCount: number;
  isPending: boolean;
  fieldPermissions: ProductFieldPermissions;
  onClearSelection: () => void;
  onSelectPage: () => void;
  onSelectAllMatching: () => void;
  onAction: (action: BulkToolbarAction) => void;
  variant?: "bar" | "inline";
  /** When true, parent owns sticky chrome — bar is not independently sticky. */
  embedded?: boolean;
};

const INLINE_BUTTON =
  "h-6 shrink-0 px-2 text-xs shadow-none";

const SELECTION_TRIGGER = "h-7 shrink-0 px-2.5 text-xs shadow-none";

type SelectionScope = "listed" | "all-matching" | "partial";

function resolveSelectionScope(
  selectAllMatching: boolean,
  pageAllSelected: boolean,
  selectedCount: number
): SelectionScope {
  if (selectAllMatching) return "all-matching";
  if (pageAllSelected && selectedCount > 0) return "listed";
  return "partial";
}

function BulkSelectionMenu({
  visibleCount,
  totalMatchingCount,
  selectionScope,
  displayCount,
  isPending,
  onSelectPage,
  onSelectAllMatching,
  onClearSelection,
  triggerClassName,
}: {
  visibleCount: number;
  totalMatchingCount: number;
  selectionScope: SelectionScope;
  displayCount: number;
  isPending: boolean;
  onSelectPage: () => void;
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
  triggerClassName?: string;
}) {
  const hasMoreThanListed = totalMatchingCount > visibleCount;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(SELECTION_TRIGGER, triggerClassName)}
          disabled={isPending || visibleCount <= 0}
        >
          Selection
          <ChevronDown className="h-3 w-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Select items for bulk actions
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectionScope === "partial" ? "" : selectionScope}
          onValueChange={(value) => {
            if (value === "listed") onSelectPage();
            if (value === "all-matching") onSelectAllMatching();
          }}
        >
          <DropdownMenuRadioItem value="listed" disabled={visibleCount <= 0}>
            Listed items ({visibleCount})
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="all-matching"
            disabled={totalMatchingCount <= 0}
          >
            All matching items ({totalMatchingCount})
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {hasMoreThanListed ? (
          <p className="px-2 pb-1 text-[11px] leading-snug text-muted-foreground">
            All matching includes items not yet loaded in the list.
          </p>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending || displayCount <= 0}
          onClick={() => onClearSelection()}
        >
          Clear selection
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProductBulkActionToolbar({
  selectedCount,
  totalMatchingCount,
  selectAllMatching,
  pageAllSelected,
  visibleCount,
  isPending,
  fieldPermissions,
  onClearSelection,
  onSelectPage,
  onSelectAllMatching,
  onAction,
  variant = "bar",
  embedded = false,
}: Props) {
  const displayCount = selectAllMatching ? totalMatchingCount : selectedCount;
  const selectionScope = resolveSelectionScope(selectAllMatching, pageAllSelected, selectedCount);
  const hasSelection = displayCount > 0;
  const canShowToolbar = visibleCount > 0;

  const allowed = fieldPermissions.allowedFields;
  const canAdjustSelling = allowed.includes("selling_price");
  const canAdjustPurchase = allowed.includes("purchase_price");
  const canPricing = canAdjustSelling || canAdjustPurchase;
  const canJurisdiction =
    allowed.includes("category_name") || allowed.includes("hsn_sac_code");
  const canCategory = allowed.includes("category_name");
  const canClassification = allowed.includes("classification");
  const canTaxCategory = allowed.includes("default_tax_category");
  const canFlags =
    allowed.includes("is_purchasable") ||
    allowed.includes("is_salable") ||
    allowed.includes("is_returnable");

  const primaryActions: ToolbarActionItem[] = [
    { id: "pricing", label: "Adjust pricing", show: canPricing },
    { id: "jurisdiction", label: "Jurisdiction sync", show: canJurisdiction },
  ];

  const secondaryActions: ToolbarActionItem[] = [
    { id: "reactivate", label: "Reactivate", show: true },
    { id: "category", label: "Change category", show: canCategory },
    { id: "classification", label: "Change classification", show: canClassification },
    { id: "taxCategory", label: "Set tax category", show: canTaxCategory },
    { id: "flags", label: "Operational flags", show: canFlags },
    { id: "tags", label: "Add / remove tags", show: true },
    { id: "storefront", label: "Storefront visibility", show: true },
    { id: "export", label: "Export selected", show: true },
  ];

  const archiveAction: ToolbarActionItem = {
    id: "archive",
    label: "Archive",
    show: true,
    variant: "destructive",
  };

  const visiblePrimary = primaryActions.filter((action) => action.show);
  const visibleSecondary = secondaryActions.filter((action) => action.show);
  const mobileMenuActions = [
    ...visiblePrimary,
    ...visibleSecondary,
    archiveAction,
  ].filter((action) => action.show);

  if (!canShowToolbar) return null;

  const selectionLabel = `${displayCount} item${displayCount === 1 ? "" : "s"} selected`;
  const compactSelectionLabel = `${displayCount} selected`;
  const idleSelectionLabel = "Select items for bulk actions";

  if (variant === "inline") {
    return (
      <div
        className="flex shrink-0 items-center gap-1 md:gap-1.5"
        role="group"
        aria-label="Bulk item actions"
      >
        <BulkSelectionMenu
          visibleCount={visibleCount}
          totalMatchingCount={totalMatchingCount}
          selectionScope={selectionScope}
          displayCount={displayCount}
          isPending={isPending}
          onSelectPage={onSelectPage}
          onSelectAllMatching={onSelectAllMatching}
          onClearSelection={onClearSelection}
          triggerClassName={INLINE_BUTTON}
        />
        {isPending ? (
          <Spinner className="h-3.5 w-3.5 text-muted-foreground" label="Processing bulk action" />
        ) : null}
        {!hasSelection ? null : (
        <div className="flex shrink-0 items-center gap-1 md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={INLINE_BUTTON}
                disabled={isPending}
              >
                Actions
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {mobileMenuActions.map((action, index) => {
                const isArchive = action.id === "archive";
                const prevIsExport = mobileMenuActions[index - 1]?.id === "export";
                return (
                  <div key={action.id}>
                    {isArchive ? <DropdownMenuSeparator /> : null}
                    {action.id === "export" && index > 0 && !prevIsExport ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    <DropdownMenuItem
                      onClick={() => onAction(action.id)}
                      className={cn(
                        action.variant === "destructive" && "text-destructive focus:text-destructive"
                      )}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        )}
        <div className="hidden shrink-0 items-center gap-1 md:flex lg:flex-wrap lg:justify-end">
          {!hasSelection ? null : visiblePrimary.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant="outline"
              className={INLINE_BUTTON}
              disabled={isPending}
              onClick={() => onAction(action.id)}
            >
              {action.id === "pricing" ? "Pricing" : "Jurisdiction"}
            </Button>
          ))}
          {!hasSelection ? null : (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className={INLINE_BUTTON}
            disabled={isPending}
            onClick={() => onAction("archive")}
          >
            Archive
          </Button>
          )}
          {!hasSelection ? null : visibleSecondary.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={INLINE_BUTTON}
                  disabled={isPending}
                >
                  More
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {visibleSecondary.map((action, index) => (
                  <div key={action.id}>
                    {action.id === "export" && index > 0 ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem onClick={() => onAction(action.id)}>{action.label}</DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={listControlShellClassName(
        cn(
          !embedded && "sticky top-0 z-30",
          "animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-sm supports-[backdrop-filter]:bg-[color-mix(in_srgb,hsl(var(--primary))_8%,hsl(var(--background)))]"
        )
      )}
      role="toolbar"
      aria-label="Bulk item actions"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className={cn(
                "truncate text-sm tracking-tight md:hidden",
                hasSelection ? "font-semibold" : "text-muted-foreground"
              )}
            >
              {hasSelection ? compactSelectionLabel : idleSelectionLabel}
            </p>
            <p
              className={cn(
                "hidden truncate text-sm tracking-tight md:block",
                hasSelection ? "font-semibold" : "text-muted-foreground"
              )}
            >
              {hasSelection ? selectionLabel : idleSelectionLabel}
            </p>
            <BulkSelectionMenu
              visibleCount={visibleCount}
              totalMatchingCount={totalMatchingCount}
              selectionScope={selectionScope}
              displayCount={displayCount}
              isPending={isPending}
              onSelectPage={onSelectPage}
              onSelectAllMatching={onSelectAllMatching}
              onClearSelection={onClearSelection}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:hidden">
          {!hasSelection ? null : isPending ? (
            <Spinner className="text-muted-foreground" label="Processing bulk action" />
          ) : null}
          {!hasSelection ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" disabled={isPending}>
                Actions
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {mobileMenuActions.map((action, index) => {
                const isArchive = action.id === "archive";
                const prevIsExport = mobileMenuActions[index - 1]?.id === "export";
                return (
                  <div key={action.id}>
                    {isArchive ? <DropdownMenuSeparator /> : null}
                    {action.id === "export" && index > 0 && !prevIsExport ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    <DropdownMenuItem
                      onClick={() => onAction(action.id)}
                      className={cn(action.variant === "destructive" && "text-destructive focus:text-destructive")}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>

        <div className="hidden min-w-0 shrink-0 items-center gap-2 md:flex lg:flex-wrap lg:justify-end">
          {!hasSelection ? null : visiblePrimary.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => onAction(action.id)}
            >
              {action.id === "pricing" ? "Adjust Pricing" : "Jurisdiction Sync"}
            </Button>
          ))}
          {!hasSelection ? null : (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => onAction("archive")}
          >
            Archive
          </Button>
          )}
          {!hasSelection ? null : visibleSecondary.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline" disabled={isPending}>
                  More
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {visibleSecondary.map((action, index) => (
                  <div key={action.id}>
                    {action.id === "export" && index > 0 ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem onClick={() => onAction(action.id)}>{action.label}</DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {!hasSelection ? null : isPending ? (
            <Spinner className="text-muted-foreground" label="Processing bulk action" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
