"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Info, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  bulkActivateCategories,
  bulkDeactivateCategories,
  bulkDeleteCategories,
  loadCategoryItemCounts,
} from "@/app/items/categories/actions";
import { CategoryBulkActionToolbar } from "@/components/categories/category-bulk-action-toolbar";
import type { CategoryBulkToolbarAction } from "@/components/categories/category-bulk-action-toolbar";
import { CategoryBulkDeleteAlert } from "@/components/categories/category-bulk-delete-alert";
import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog";
import { CategoryDrawerForm } from "@/components/categories/category-drawer-form";
import { CategoryEmptyState } from "@/components/categories/category-empty-state";
import { CategoryListTable } from "@/components/categories/category-list-table";
import { CategoryListToolbar } from "@/components/categories/category-list-toolbar";
import { CategoryTreePanel } from "@/components/categories/category-tree-panel";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeviceClass } from "@/hooks/use-device-class";
import { CATEGORIES_HREF } from "@/lib/categories/category-navigation";
import { downloadCategoryListCsv } from "@/lib/categories/bulk-export";
import { enrichCategoryListRows } from "@/lib/categories/list-row";
import {
  getColumnPrefsSlice,
  getDefaultCategoryListPrefs,
  getOrderedVisibleColumns,
  isCategoryTableLikeViewMode,
  loadCategoryListPrefs,
  resolveFrozenColumnCount,
  saveCategoryListPrefs,
  setColumnWidthSlice,
  type CategoryListPrefs,
  type CategoryTableViewMode,
} from "@/lib/categories/list-prefs";
import { sortCategoryListRows } from "@/lib/categories/list-sort";
import {
  patchCategoryActiveState,
  removeCategoryRow,
  upsertCategoryRow,
} from "@/lib/categories/row-state";
import type { CategoryRow } from "@/lib/categories/types";
import { flattenTree } from "@/lib/categories/tree";
import { useFilteredCategories } from "@/lib/categories/use-filtered-categories";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const CATEGORIES_PAGE_DESCRIPTION =
  "Configure hierarchical item categories and inherited attribute templates.";

type Props = {
  initialRows: CategoryRow[];
  itemCountByCategoryId?: Record<string, number>;
  initialSavedView?: SavedViewSnapshot | null;
};

function CategoriesPageTitleHeader({ onNewCategory }: { onNewCategory: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2.5 sm:mb-5">
      <div className="flex min-w-0 items-center gap-1.5">
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">Categories</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label="About Categories"
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-3">
            <p className="text-sm leading-snug text-muted-foreground">
              {CATEGORIES_PAGE_DESCRIPTION}
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button type="button" className="shrink-0 gap-1.5" onClick={onNewCategory}>
        <Plus className="h-4 w-4" aria-hidden />
        New
      </Button>
    </div>
  );
}

function resolveBulkCategoryIds(
  bulkSelectAllMatching: boolean,
  bulkSelectedIds: Set<string>,
  matchingIds: string[]
): string[] {
  if (bulkSelectAllMatching) return matchingIds;
  return [...bulkSelectedIds];
}

export function CategoryManagementTerminal({
  initialRows,
  itemCountByCategoryId: initialItemCountByCategoryId = {},
  initialSavedView = null,
}: Props) {
  const drawer = useModuleDrawerUrl(CATEGORIES_HREF, { canonicalizeLegacy: true });
  const omnibar = useOptionalOmnibarContext();
  const serverViewHydratedRef = useRef(false);
  const { deviceClass } = useDeviceClass();
  const [rows, setRows] = useState(initialRows);
  const [itemCountByCategoryId, setItemCountByCategoryId] = useState(
    initialItemCountByCategoryId
  );
  const itemCountsRequestedRef = useRef(
    Object.keys(initialItemCountByCategoryId).length > 0
  );
  const [pendingDelete, setPendingDelete] = useState<CategoryRow | null>(null);
  const [prefs, setPrefs] = useState<CategoryListPrefs>(getDefaultCategoryListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    if (itemCountsRequestedRef.current) return;
    itemCountsRequestedRef.current = true;
    void loadCategoryItemCounts().then(setItemCountByCategoryId);
  }, []);

  const { filteredTree, filteredRows, totalCount, resultCount } =
    useFilteredCategories(rows);

  const selectedId = drawer.recordId;
  const peekCategory =
    drawer.recordId != null
      ? (rows.find((row) => row.id === drawer.recordId) ?? null)
      : null;

  const tableViewMode: CategoryTableViewMode =
    prefs.viewMode === "compact" ? "compact" : "table";

  const listRows = useMemo(() => {
    const enriched = enrichCategoryListRows(
      filteredRows,
      rows,
      itemCountByCategoryId
    );
    return sortCategoryListRows(enriched, prefs.sortField, prefs.sortDirection);
  }, [
    filteredRows,
    rows,
    itemCountByCategoryId,
    prefs.sortDirection,
    prefs.sortField,
  ]);

  const visibleCategoryIds = useMemo(() => {
    if (isCategoryTableLikeViewMode(prefs.viewMode)) {
      return listRows.map((row) => row.id);
    }
    return flattenTree(filteredTree).map((node) => node.id);
  }, [filteredTree, listRows, prefs.viewMode]);

  const matchingCategoryIds = useMemo(
    () => filteredRows.map((row) => row.id),
    [filteredRows]
  );

  const pageAllSelected =
    visibleCategoryIds.length > 0 &&
    visibleCategoryIds.every((id) => bulkSelectedIds.has(id));
  const pageSomeSelected =
    visibleCategoryIds.some((id) => bulkSelectedIds.has(id)) && !pageAllSelected;

  const visibleColumns = useMemo(
    () =>
      isCategoryTableLikeViewMode(prefs.viewMode)
        ? getOrderedVisibleColumns(prefs, tableViewMode, deviceClass)
        : [],
    [deviceClass, prefs, tableViewMode]
  );

  const columnPrefsSlice = getColumnPrefsSlice(prefs, tableViewMode, deviceClass);
  const frozenColumnCount = resolveFrozenColumnCount(prefs, deviceClass);

  const bulkSelectionCount = bulkSelectAllMatching
    ? matchingCategoryIds.length
    : bulkSelectedIds.size;

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
    setBulkSelectAllMatching(false);
  }, []);

  const resolveSelectedIds = useCallback(
    () =>
      resolveBulkCategoryIds(bulkSelectAllMatching, bulkSelectedIds, matchingCategoryIds),
    [bulkSelectAllMatching, bulkSelectedIds, matchingCategoryIds]
  );

  const handleSelectCategory = useCallback(
    (categoryId: string) => {
      drawer.openPeek(categoryId);
    },
    [drawer]
  );

  const handleBulkRowToggle = useCallback((categoryId: string, checked: boolean) => {
    setBulkSelectAllMatching(false);
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(categoryId);
      else next.delete(categoryId);
      return next;
    });
  }, []);

  const handleBulkPageToggle = useCallback(
    (checked: boolean) => {
      setBulkSelectAllMatching(false);
      setBulkSelectedIds((current) => {
        const next = new Set(current);
        for (const id of visibleCategoryIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [visibleCategoryIds]
  );

  const handleBulkSuccess = useCallback(
    (message: string, patch?: (current: CategoryRow[]) => CategoryRow[]) => {
      toast.success(message);
      if (patch) setRows(patch);
      clearBulkSelection();
      setBulkDeleteOpen(false);
    },
    [clearBulkSelection]
  );

  const handleCategorySaved = useCallback(
    (categoryId: string, category: CategoryRow) => {
      setRows((current) => upsertCategoryRow(current, category));
      drawer.afterSave(categoryId);
    },
    [drawer]
  );

  const handleCategoryDeleted = useCallback(
    (categoryId: string) => {
      setRows((current) => removeCategoryRow(current, categoryId));
      setItemCountByCategoryId((current) => {
        if (!(categoryId in current)) return current;
        const next = { ...current };
        delete next[categoryId];
        return next;
      });
      if (drawer.recordId === categoryId) {
        drawer.close();
      }
      setPendingDelete(null);
      clearBulkSelection();
    },
    [clearBulkSelection, drawer]
  );

  const handleCategoryDeactivated = useCallback((category: CategoryRow) => {
    setRows((current) => upsertCategoryRow(current, category));
  }, []);

  const runBulkActivate = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      toast.error("Select at least one category.");
      return;
    }
    startBulkTransition(async () => {
      const result = await bulkActivateCategories(ids);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const count = result.affectedIds?.length ?? 0;
      handleBulkSuccess(
        `${count} categor${count === 1 ? "y" : "ies"} activated.`,
        (current) => patchCategoryActiveState(current, result.affectedIds ?? [], true)
      );
    });
  }, [handleBulkSuccess, resolveSelectedIds]);

  const runBulkDeactivate = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      toast.error("Select at least one category.");
      return;
    }
    startBulkTransition(async () => {
      const result = await bulkDeactivateCategories(ids);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const count = result.affectedIds?.length ?? 0;
      handleBulkSuccess(
        `${count} categor${count === 1 ? "y" : "ies"} deactivated.`,
        (current) => patchCategoryActiveState(current, result.affectedIds ?? [], false)
      );
    });
  }, [handleBulkSuccess, resolveSelectedIds]);

  const runBulkDelete = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      toast.error("Select at least one category.");
      return;
    }
    startBulkTransition(async () => {
      const result = await bulkDeleteCategories(ids);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const deletedCount = result.deletedIds?.length ?? 0;
      if (result.skippedCount && result.skippedCount > 0) {
        toast.warning(
          `Deleted ${deletedCount}; ${result.skippedCount} could not be deleted (children or assigned items).`
        );
      } else {
        toast.success(
          `Deleted ${deletedCount} categor${deletedCount === 1 ? "y" : "ies"}.`
        );
      }
      setRows((current) =>
        result.deletedIds?.reduce((next, categoryId) => removeCategoryRow(next, categoryId), current) ??
        current
      );
      setItemCountByCategoryId((current) => {
        const next = { ...current };
        for (const categoryId of result.deletedIds ?? []) {
          delete next[categoryId];
        }
        return next;
      });
      if (drawer.recordId && result.deletedIds?.includes(drawer.recordId)) {
        drawer.close();
      }
      clearBulkSelection();
      setBulkDeleteOpen(false);
    });
  }, [clearBulkSelection, drawer, resolveSelectedIds]);

  const runBulkExport = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      toast.error("Select at least one category.");
      return;
    }
    const idSet = new Set(ids);
    const rows = listRows.filter((row) => idSet.has(row.id));
    if (rows.length === 0) {
      const enriched = enrichCategoryListRows(
        filteredRows.filter((row) => idSet.has(row.id)),
        rows,
        itemCountByCategoryId
      );
      downloadCategoryListCsv(enriched);
    } else {
      downloadCategoryListCsv(rows);
    }
    toast.success(`Exported ${ids.length} categor${ids.length === 1 ? "y" : "ies"}.`);
  }, [filteredRows, rows, itemCountByCategoryId, listRows, resolveSelectedIds]);

  const handleBulkToolbarAction = useCallback(
    (action: CategoryBulkToolbarAction) => {
      switch (action) {
        case "activate":
          runBulkActivate();
          break;
        case "deactivate":
          runBulkDeactivate();
          break;
        case "delete":
          setBulkDeleteOpen(true);
          break;
        case "export":
          runBulkExport();
          break;
      }
    },
    [runBulkActivate, runBulkDeactivate, runBulkExport]
  );

  useLayoutEffect(() => {
    if (!omnibar || serverViewHydratedRef.current) return;
    serverViewHydratedRef.current = true;
    if (initialSavedView) {
      omnibar.hydrateModuleViewFromServer(initialSavedView, null);
      return;
    }
    omnibar.markDefaultViewResolvedOnServer("categories");
  }, [initialSavedView, omnibar]);

  useEffect(() => {
    setPrefs(loadCategoryListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveCategoryListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const openDelete = (category: CategoryRow) => {
    setPendingDelete(category);
  };

  const listPrimary =
    rows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <CategoryEmptyState onCreate={drawer.openCreate} hasExistingCategories={false} />
      </div>
    ) : isCategoryTableLikeViewMode(prefs.viewMode) ? (
      <CategoryListTable
        rows={listRows}
        columns={visibleColumns}
        columnWrapModes={columnPrefsSlice.columnWrapModes}
        columnChipDisplay={columnPrefsSlice.columnChipDisplay}
        columnWidths={columnPrefsSlice.columnWidths}
        deviceClass={deviceClass}
        selectedId={selectedId}
        bulkSelectedIds={bulkSelectedIds}
        pageAllSelected={pageAllSelected}
        pageSomeSelected={pageSomeSelected}
        sortField={prefs.sortField}
        sortDirection={prefs.sortDirection}
        frozenColumnCount={frozenColumnCount}
        freezeColumnsAuto
        compactRows={prefs.viewMode === "compact"}
        onSortChange={(sortField, sortDirection) =>
          setPrefs((current) => ({ ...current, sortField, sortDirection }))
        }
        onColumnWidthChange={(columnId, width) =>
          setPrefs((current) =>
            setColumnWidthSlice(current, tableViewMode, deviceClass, columnId, width)
          )
        }
        onSelect={handleSelectCategory}
        onBulkRowToggle={handleBulkRowToggle}
        onBulkPageToggle={handleBulkPageToggle}
      />
    ) : (
      <CategoryTreePanel
        filteredTree={filteredTree}
        totalRows={totalCount}
        selectedId={selectedId}
        bulkSelectedIds={bulkSelectedIds}
        onSelect={handleSelectCategory}
        onBulkRowToggle={handleBulkRowToggle}
      />
    );

  const body = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
      {listPrimary}
    </div>
  );

  const bulkToolbar =
    rows.length > 0 && bulkSelectionCount > 0 ? (
      <CategoryBulkActionToolbar
        selectedCount={bulkSelectedIds.size}
        totalMatchingCount={matchingCategoryIds.length}
        selectAllMatching={bulkSelectAllMatching}
        pageAllSelected={pageAllSelected}
        visibleCount={visibleCategoryIds.length}
        isPending={isBulkPending}
        onClearSelection={clearBulkSelection}
        onSelectPage={() => handleBulkPageToggle(true)}
        onSelectAllMatching={() => {
          setBulkSelectAllMatching(true);
          setBulkSelectedIds(new Set(matchingCategoryIds));
        }}
        onAction={handleBulkToolbarAction}
        embedded
      />
    ) : null;

  const drawerOpen = drawer.isOpen;

  return (
    <>
      <ListModuleShell
        title={<CategoriesPageTitleHeader onNewCategory={drawer.openCreate} />}
        toolbar={
          rows.length > 0 ? (
            <CategoryListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              detectedDeviceClass={deviceClass}
              resultCount={resultCount}
              totalCount={totalCount}
              compactCountLabel={drawer.isOpen}
              prefsHydrated={prefsHydrated}
            />
          ) : null
        }
        bulkToolbar={bulkToolbar}
      >
        {body}
      </ListModuleShell>

      <CategoryDrawerForm
        open={drawerOpen}
        surface={drawer.surface}
        rows={rows}
        peekCategory={peekCategory}
        onClose={drawer.close}
        onOpenEdit={drawer.openEdit}
        onAfterSave={handleCategorySaved}
        onDelete={openDelete}
      />

      <CategoryDeleteDialog
        category={pendingDelete}
        rows={rows}
        itemCountByCategoryId={itemCountByCategoryId}
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        onDeleted={handleCategoryDeleted}
        onDeactivated={handleCategoryDeactivated}
      />

      <CategoryBulkDeleteAlert
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        onConfirm={runBulkDelete}
      />
    </>
  );
}
