"use client";

import { ArrowUpDown, FolderTree, Layers, List } from "lucide-react";
import {
  HorizontalCardsStackedIcon,
  ShopCardsRowIcon,
} from "@/components/products/product-list-view-icons";
import { Spinner } from "@/components/ui/spinner";
import { ModuleViewSelect } from "@/components/search/module-view-select";
import { ProductListToolbarFilters } from "@/components/products/product-list-toolbar-filters";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { ProductListColumnSettings } from "@/components/products/product-list-column-settings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  applyProductListDisplayPreset,
  getProductListDisplayPreset,
  isCardViewMode,
  isProductListDisplayPresetActive,
  isTableLikeViewMode,
  resolveProductListExpandVariants,
  supportsProductListVariantExpansion,
  type DeviceClass,
  type ProductListDisplayPreset,
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
  listToolbarIconButtonClass,
  LIST_TOOLBAR_ROW_GAP,
  LIST_TOOLBAR_ROW_MIN_HEIGHT,
  LIST_TOOLBAR_TEXT,
  LIST_TOOLBAR_TOOLS_GAP,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";
import type { ListWorkspaceLayout } from "@/lib/layout/list-workspace";
import type { ComponentType, ReactNode, SVGProps } from "react";

type CategoryOption = {
  id: string;
  label: string;
};

const MOBILE_SELECT_WIDTH = "w-[6rem] sm:w-[8.5rem]";

const VIEW_PRESET_OPTIONS: {
  id: ProductListDisplayPreset;
  label: string;
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { id: "list", label: "List", title: "List view", icon: List },
  {
    id: "horizontal",
    label: "Horizontal",
    title: "Horizontal card view",
    icon: HorizontalCardsStackedIcon,
  },
  { id: "shop", label: "Shop", title: "Shop card view", icon: ShopCardsRowIcon },
];

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
  /** Deep-link peek refresh — list totals are not loaded yet. */
  listCountPending?: boolean;
  /** Replaces List / Horizontal / Shop when using list workspace layouts. */
  workspaceLayoutToggle?: ReactNode;
  /** Hides card/table view presets (workspace layouts always use table). */
  hideViewPresets?: boolean;
  /** Matrix registry column picker — visibility/order only; no layout presets. */
  columnSettingsMode?: "default" | "items-matrix";
  /** Items list workspace layout — drives split-specific column settings behavior. */
  workspaceLayout?: ListWorkspaceLayout;
  /** Icon-only category and variant controls for the unified Items header. */
  compactFilterControls?: boolean;
};

export type ProductListToolbarProps = Props;

function presetIcon(preset: ProductListDisplayPreset) {
  const option = VIEW_PRESET_OPTIONS.find((entry) => entry.id === preset);
  const Icon = option?.icon ?? List;
  return <Icon className="h-4 w-4" aria-hidden />;
}

export function ProductListToolbar(props: Props) {
  const { countNode, controlsShellNode } = useProductListToolbarParts(props);

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
        {countNode}
        {controlsShellNode}
      </div>
    </div>
  );
}

/** Unified Items header — result count slot. */
export function ProductListToolbarCount(props: Props) {
  const { countNode } = useProductListToolbarParts({ ...props, compactCountLabel: true });
  return countNode;
}

/** Unified Items header — filters, sort, and column controls slot. */
export function ProductListToolbarControls(props: Props) {
  const { controlsShellNode } = useProductListToolbarParts(props);
  return controlsShellNode;
}

function useProductListToolbarParts({
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
  listCountPending = false,
  workspaceLayoutToggle,
  hideViewPresets = false,
  columnSettingsMode = "default",
  workspaceLayout,
  compactFilterControls = false,
}: Props) {
  const omnibar = useOptionalOmnibarContext();
  const controlsDisabled = !prefsHydrated || isSavingPrefs;
  const viewMode = activeViewMode ?? prefs.viewMode;
  const activePreset = getProductListDisplayPreset({ ...prefs, viewMode });
  const isViewFilterActive = omnibar?.hasActiveFilters ?? false;
  const isCategoryFilterActive = categoryFilter !== "all";
  const activeCategoryLabel =
    categoryOptions.find((option) => option.id === categoryFilter)?.label ?? "All categories";

  const setDisplayPreset = (preset: ProductListDisplayPreset) => {
    if (controlsDisabled || viewModeToggleLocked || activePreset === preset) return;
    const nextPrefs = applyProductListDisplayPreset(prefs, preset);
    onPrefsChange(nextPrefs);
    onExpandVariantsChange?.(
      resolveProductListExpandVariants(prefs.showVariants, nextPrefs.viewMode)
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

  const fullCountText = listCountPending
    ? "Loading item count…"
    : `Showing ${resultCount} of ${totalCount} ${countLabel}.`;
  const shortCountText = listCountPending
    ? "Loading…"
    : `Showing ${resultCount} of ${totalCount}`;
  const ratioCountText = listCountPending ? "…" : `${resultCount}/${totalCount}`;

  const countNode = (
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
  );

  const controlsNode = (
    <>
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

      {compactFilterControls ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={controlsDisabled}
              className={listToolbarIconButtonClass(isCategoryFilterActive)}
              title={
                isCategoryFilterActive ? `Category: ${activeCategoryLabel}` : "Filter by category"
              }
              aria-label={
                isCategoryFilterActive ? `Category: ${activeCategoryLabel}` : "Filter by category"
              }
            >
              <FolderTree className="h-4 w-4 shrink-0" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuRadioGroup
              value={categoryFilter}
              onValueChange={onCategoryFilterChange}
            >
              <DropdownMenuRadioItem value="all">All categories</DropdownMenuRadioItem>
              {categoryOptions.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger
            className={cn(listToolbarSelectClass(isCategoryFilterActive), MOBILE_SELECT_WIDTH)}
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
      )}

      {supportsProductListVariantExpansion(viewMode) ? (
        compactFilterControls ? (
          <Button
            type="button"
            variant="ghost"
            disabled={controlsDisabled || isExpandVariantsSyncing}
            className={listToolbarIconButtonClass(prefs.showVariants)}
            title={VARIANTS_LIST_TOGGLE_LABEL}
            aria-label={VARIANTS_LIST_TOGGLE_LABEL}
            aria-pressed={prefs.showVariants}
            onClick={() => {
              const showVariants = !prefs.showVariants;
              onPrefsChange((current) => ({
                ...current,
                showVariants,
              }));
              onShowVariantsChange?.(showVariants);
            }}
          >
            <Layers className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        ) : (
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
        )
      ) : null}

      {isCardViewMode(viewMode) && !hideViewPresets ? (
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

      {hideViewPresets && isTableLikeViewMode(viewMode) ? (
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

      {workspaceLayoutToggle}

      {!hideViewPresets ? (
        <>
          <div className="shrink-0 sm:hidden">
            <Select
              value={activePreset}
              disabled={controlsDisabled || viewModeToggleLocked}
              onValueChange={(value) => setDisplayPreset(value as ProductListDisplayPreset)}
            >
              <SelectTrigger
                className={cn(listToolbarSelectClass(true), "w-auto px-1.5 [&>svg]:hidden")}
                aria-label="View mode"
                aria-busy={isSavingPrefs}
                title={
                  viewModeToggleLocked
                    ? "Card view switches to list while item detail is open"
                    : "View mode"
                }
              >
                <span className="flex items-center">{presetIcon(activePreset)}</span>
              </SelectTrigger>
              <SelectContent align="end">
                {VIEW_PRESET_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <span className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" aria-hidden />
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className={cn(listToolbarViewToggleShellClass(), "hidden sm:inline-flex")}
            aria-busy={isSavingPrefs}
            title={
              viewModeToggleLocked ? "Card view switches to list while item detail is open" : undefined
            }
          >
            {VIEW_PRESET_OPTIONS.map((option) => {
              const selected = isProductListDisplayPresetActive({ ...prefs, viewMode }, option.id);
              const savingThisPreset = isSavingPrefs && activePreset === option.id;
              return (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={listToolbarViewToggleSegmentClass(selected)}
                  disabled={controlsDisabled || viewModeToggleLocked}
                  onClick={() => setDisplayPreset(option.id)}
                  title={option.title}
                  aria-label={option.title}
                  aria-pressed={selected}
                >
                  {savingThisPreset ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <option.icon className="h-4 w-4" />
                  )}
                </Button>
              );
            })}
          </div>
        </>
      ) : null}

      <ProductListColumnSettings
        prefs={{ ...prefs, viewMode }}
        onChange={onPrefsChange}
        fieldPermissions={fieldPermissions}
        detectedDeviceClass={detectedDeviceClass}
        disabled={controlsDisabled}
        isSaving={isSavingColumnPrefs}
        mode={columnSettingsMode}
        workspaceLayout={workspaceLayout}
      />
    </>
  );

  const controlsShellNode = (
    <div
      className={cn(
        "relative z-10 flex min-w-0 flex-1 items-center justify-end overflow-x-auto overflow-y-visible",
        LIST_TOOLBAR_TOOLS_GAP,
        LIST_TOOLBAR_CONTROL_HEIGHT,
        LIST_TOOLBAR_TEXT,
        "flex-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      {controlsNode}
    </div>
  );

  return { countNode, controlsShellNode };
}
