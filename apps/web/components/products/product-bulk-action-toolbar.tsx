"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  visibleCount: number;
  isPending: boolean;
  fieldPermissions: ProductFieldPermissions;
  onClearSelection: () => void;
  onSelectAllMatching: () => void;
  onAction: (action: BulkToolbarAction) => void;
};

export function ProductBulkActionToolbar({
  selectedCount,
  totalMatchingCount,
  selectAllMatching,
  visibleCount,
  isPending,
  fieldPermissions,
  onClearSelection,
  onSelectAllMatching,
  onAction,
}: Props) {
  const displayCount = selectAllMatching ? totalMatchingCount : selectedCount;
  const canShowSelectAllLink =
    !selectAllMatching &&
    selectedCount > 0 &&
    visibleCount > 0 &&
    selectedCount >= visibleCount &&
    totalMatchingCount > visibleCount;

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

  if (displayCount <= 0) return null;

  const selectionLabel = `${displayCount} Item Master${displayCount === 1 ? "" : "s"} Selected`;
  const compactSelectionLabel = `${displayCount} selected`;

  return (
    <div
      className={listControlShellClassName(
        "animate-in fade-in slide-in-from-top-2 duration-200"
      )}
      role="toolbar"
      aria-label="Bulk item actions"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold tracking-tight md:hidden">
              {compactSelectionLabel}
            </p>
            <p className="hidden truncate text-sm font-semibold tracking-tight md:block">
              {selectionLabel}
            </p>
            {canShowSelectAllLink ? (
              <button
                type="button"
                onClick={() => onSelectAllMatching()}
                disabled={isPending}
                className="hidden shrink-0 text-xs text-primary transition-colors duration-200 hover:underline disabled:opacity-50 sm:inline"
              >
                All {totalMatchingCount}
              </button>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs">
            {canShowSelectAllLink ? (
              <button
                type="button"
                onClick={() => onSelectAllMatching()}
                disabled={isPending}
                className="text-primary transition-colors duration-200 hover:underline disabled:opacity-50 sm:hidden"
              >
                Select all {totalMatchingCount}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onClearSelection()}
              disabled={isPending}
              className="shrink-0 text-muted-foreground transition-colors duration-200 hover:text-foreground disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:hidden">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Processing bulk action" />
          ) : null}
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
        </div>

        <div className="hidden min-w-0 shrink-0 items-center gap-2 md:flex lg:flex-wrap lg:justify-end">
          {visiblePrimary.map((action) => (
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
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => onAction("archive")}
          >
            Archive
          </Button>
          {visibleSecondary.length > 0 ? (
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
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Processing bulk action" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
