"use client";

import { ArrowUpDown, LayoutGrid, Rows3, Table2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ModuleViewSelect } from "@/components/search/module-view-select";
import { ProductListToolbarFilters } from "@/components/products/product-list-toolbar-filters";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { ProductListColumnSettings } from "@/components/products/product-list-column-settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VARIANTS_LIST_TOGGLE_LABEL } from "@/lib/products/product-user-labels";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import {
  isCardViewMode,
  resolveProductListExpandVariants,
  supportsProductListVariantExpansion,
  type DeviceClass,
  type ProductListPrefs,
  type ProductListViewMode,
} from "@/lib/products/list-prefs";
import {
  DEFAULT_PRODUCT_LIST_SORT_DIRECTION,
  DEFAULT_PRODUCT_LIST_SORT_FIELD,
  PRODUCT_LIST_SORT_OPTIONS,
  sortOptionKey,
} from "@/lib/products/list-sort";
import {
  LIST_TOOLBAR_MODULE_VIEW_WIDTH,
  listToolbarModuleViewTriggerClass,
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleSegmentClass,
  listToolbarViewToggleShellClass,
  LIST_TOOLBAR_CONTROL_HEIGHT,
  LIST_TOOLBAR_ROW_GAP,
  LIST_TOOLBAR_ROW_MIN_HEIGHT,
  LIST_TOOLBAR_TEXT,
  LIST_TOOLBAR_TOOLS_GAP,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

type CategoryOption = {
  id: string;
  label: string;
};

const MOBILE_SELECT_WIDTH = "w-[6rem] sm:w-[8.5rem]";

type Props = {
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categoryOptions: CategoryOption[];
  prefs: ProductListPrefs;
  onPrefsChange: (
    prefs: ProductListPrefs | ((current: ProductListPrefs) => ProductListPrefs)
  ) => void;
  /** Fired when the user toggles variant expansion (triggers list refetch). */
  onShowVariantsChange?: (showVariants: boolean) => void;
  /** Fired when view mode changes and variant expansion eligibility changes. */
  onExpandVariantsChange?: (expandVariants: boolean) => void;
  fieldPermissions: ProductFieldPermissions;
  detectedDeviceClass: DeviceClass;
  resultCount: number;
  totalCount: number;
  prefsHydrated?: boolean;
  isSavingPrefs?: boolean;
  isSavingColumnPrefs?: boolean;
  isExpandVariantsSyncing?: boolean;
  /** Overrides prefs.viewMode for display (e.g. force table while detail pane is open). */
  activeViewMode?: ProductListViewMode;
  /** Disables view toggle while detail pane forces table layout. */
  viewModeToggleLocked?: boolean;
  /** Uses compact result count (e.g. while split-pane detail is open). */
  compactCountLabel?: boolean;
};

export function ProductListToolbar({
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
  prefs,
  onPrefsChange,
  onShowVariantsChange,
  onExpandVariantsChange,
  fieldPermissions,
  detectedDeviceClass,
  resultCount,
  totalCount,
  prefsHydrated = true,
  isSavingPrefs = false,
  isSavingColumnPrefs = false,
  isExpandVariantsSyncing = false,
  activeViewMode,
  viewModeToggleLocked = false,
  compactCountLabel = false,
}: Props) {
  const omnibar = useOptionalOmnibarContext();
  const controlsDisabled = !prefsHydrated || isSavingPrefs;
  const viewMode = activeViewMode ?? prefs.viewMode;
  const isViewFilterActive = omnibar?.hasActiveFilters ?? false;
  const isCategoryFilterActive = categoryFilter !== "all";

  const setViewMode = (nextViewMode: ProductListViewMode) => {
    if (controlsDisabled || viewModeToggleLocked || prefs.viewMode === nextViewMode) return;
    onPrefsChange({ ...prefs, viewMode: nextViewMode });
    onExpandVariantsChange?.(
      resolveProductListExpandVariants(prefs.showVariants, nextViewMode)
    );
  };

  const sortValue = sortOptionKey(prefs.sortField, prefs.sortDirection);
  const allowedSortFields = new Set(fieldPermissions.allowedFields);
  const sortOptions = PRODUCT_LIST_SORT_OPTIONS.filter((option) =>
    allowedSortFields.has(option.field)
  );
  const activeSortLabel =
    sortOptions.find(
      (option) => sortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";
  const isSortActive =
    prefs.sortField !== DEFAULT_PRODUCT_LIST_SORT_FIELD ||
    prefs.sortDirection !== DEFAULT_PRODUCT_LIST_SORT_DIRECTION;

  const countLabel =
    supportsProductListVariantExpansion(viewMode) && prefs.showVariants
      ? `row${totalCount === 1 ? "" : "s"}`
      : `product${totalCount === 1 ? "" : "s"}`;

  const fullCountText = `Showing ${resultCount} of ${totalCount} ${countLabel}.`;
  const shortCountText = `Showing ${resultCount} of ${totalCount}`;
  const ratioCountText = `${resultCount}/${totalCount}`;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-w-0 flex-nowrap items-center text-muted-foreground",
          LIST_TOOLBAR_ROW_GAP,
          LIST_TOOLBAR_ROW_MIN_HEIGHT,
          LIST_TOOLBAR_TEXT
        )}
      >
        <span
          className={cn(
            "min-w-0 shrink truncate whitespace-nowrap tabular-nums",
            compactCountLabel
              ? "max-w-[5.5rem] sm:max-w-[6.5rem]"
              : "max-w-[5.5rem] sm:max-w-[7.5rem] md:max-w-[10rem] lg:max-w-[14rem] xl:max-w-[18rem] 2xl:max-w-[24rem]"
          )}
          title={compactCountLabel ? ratioCountText : fullCountText}
        >
          {compactCountLabel ? (
            ratioCountText
          ) : (
            <>
              <span className="lg:hidden">{ratioCountText}</span>
              <span className="hidden lg:inline 2xl:hidden">{shortCountText}</span>
              <span className="hidden 2xl:inline">{fullCountText}</span>
            </>
          )}
        </span>

        <div
          className={cn(
            "relative z-10 flex min-w-0 flex-1 items-center justify-end overflow-x-auto overflow-y-visible",
            LIST_TOOLBAR_TOOLS_GAP,
            LIST_TOOLBAR_CONTROL_HEIGHT,
            "flex-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          <ProductListToolbarFilters
            categoryFilter={categoryFilter}
            onCategoryFilterChange={onCategoryFilterChange}
            categoryOptions={categoryOptions}
          />

          <ModuleViewSelect
            borderless
            menuAlign="end"
            className="min-w-0 shrink-0"
            triggerActive={isViewFilterActive}
            triggerClassName={cn(
              listToolbarModuleViewTriggerClass(isViewFilterActive),
              LIST_TOOLBAR_MODULE_VIEW_WIDTH
            )}
          />

          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger
              className={cn(
                listToolbarSelectClass(isCategoryFilterActive),
                MOBILE_SELECT_WIDTH
              )}
            >
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {supportsProductListVariantExpansion(viewMode) ? (
            <div className="flex shrink-0 items-center gap-0.5 dark:rounded-md dark:bg-[hsl(224_47%_13%)] dark:px-1.5 dark:py-0.5">
              <Switch
                id="show-variants-toggle"
                checked={prefs.showVariants}
                disabled={controlsDisabled || isExpandVariantsSyncing}
                className="h-5 w-9 shrink-0 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4 [&>span]:shadow-sm"
                onCheckedChange={(checked) => {
                  const showVariants = checked === true;
                  onPrefsChange((current) => ({
                    ...current,
                    showVariants,
                  }));
                  onShowVariantsChange?.(showVariants);
                }}
                aria-label={VARIANTS_LIST_TOGGLE_LABEL}
              />
              <Label
                htmlFor="show-variants-toggle"
                className="ml-1.5 hidden cursor-pointer text-sm font-normal text-muted-foreground md:inline"
              >
                {VARIANTS_LIST_TOGGLE_LABEL}
              </Label>
            </div>
          ) : null}

          {isCardViewMode(viewMode) ? (
            <div className={cn(listToolbarViewToggleShellClass(), "hidden sm:inline-flex")}>
              <Select
                value={sortValue}
                disabled={controlsDisabled}
                onValueChange={(value) => {
                  const option = PRODUCT_LIST_SORT_OPTIONS.find(
                    (entry) => sortOptionKey(entry.field, entry.direction) === value
                  );
                  if (!option) return;
                  onPrefsChange({
                    ...prefs,
                    sortField: option.field,
                    sortDirection: option.direction,
                  });
                }}
              >
                <SelectTrigger
                  className={listToolbarSortTriggerClass(isSortActive)}
                  title={`Sort: ${activeSortLabel}`}
                  aria-label={`Sort products: ${activeSortLabel}`}
                >
                  <SelectValue />
                  <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden />
                </SelectTrigger>
                <SelectContent align="end">
                  {sortOptions.map((option) => (
                    <SelectItem
                      key={sortOptionKey(option.field, option.direction)}
                      value={sortOptionKey(option.field, option.direction)}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="shrink-0 sm:hidden">
            <Select
              value={viewMode}
              disabled={controlsDisabled || viewModeToggleLocked}
              onValueChange={(value) => setViewMode(value as ProductListViewMode)}
            >
              <SelectTrigger
                className={cn(listToolbarSelectClass(true), "w-auto px-1.5 [&>svg]:hidden")}
                aria-label="View mode"
                aria-busy={isSavingPrefs}
                title={
                  viewModeToggleLocked
                    ? "Card view switches to table while item detail is open"
                    : "View mode"
                }
              >
                <span className="flex items-center">
                  {viewMode === "table" ? (
                    <Table2 className="h-4 w-4" aria-hidden />
                  ) : viewMode === "compact" ? (
                    <Rows3 className="h-4 w-4" aria-hidden />
                  ) : (
                    <LayoutGrid className="h-4 w-4" aria-hidden />
                  )}
                </span>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="table">
                  <span className="flex items-center gap-2">
                    <Table2 className="h-4 w-4" aria-hidden />
                    Table
                  </span>
                </SelectItem>
                <SelectItem value="compact">
                  <span className="flex items-center gap-2">
                    <Rows3 className="h-4 w-4" aria-hidden />
                    Compact
                  </span>
                </SelectItem>
                <SelectItem value="card">
                  <span className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" aria-hidden />
                    Card
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className={cn(listToolbarViewToggleShellClass(), "hidden sm:inline-flex")}
            aria-busy={isSavingPrefs}
            title={
              viewModeToggleLocked ? "Card view switches to table while item detail is open" : undefined
            }
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={listToolbarViewToggleSegmentClass(viewMode === "table")}
              disabled={controlsDisabled || viewModeToggleLocked}
              onClick={() => setViewMode("table")}
              title="Table view"
              aria-label="Table view"
              aria-pressed={viewMode === "table"}
            >
              {isSavingPrefs && prefs.viewMode === "table" ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Table2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={listToolbarViewToggleSegmentClass(viewMode === "compact")}
              disabled={controlsDisabled || viewModeToggleLocked}
              onClick={() => setViewMode("compact")}
              title="Compact table"
              aria-label="Compact table"
              aria-pressed={viewMode === "compact"}
            >
              {isSavingPrefs && prefs.viewMode === "compact" ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Rows3 className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={listToolbarViewToggleSegmentClass(viewMode === "card")}
              disabled={controlsDisabled || viewModeToggleLocked}
              onClick={() => setViewMode("card")}
              title="Card view"
              aria-label="Card view"
              aria-pressed={viewMode === "card"}
            >
              {isSavingPrefs && prefs.viewMode === "card" ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <LayoutGrid className="h-4 w-4" />
              )}
            </Button>
          </div>

          <ProductListColumnSettings
            prefs={{ ...prefs, viewMode }}
            onChange={onPrefsChange}
            fieldPermissions={fieldPermissions}
            detectedDeviceClass={detectedDeviceClass}
            disabled={controlsDisabled}
            isSaving={isSavingColumnPrefs}
          />
        </div>
      </div>
    </div>
  );
}
