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
import { toast } from "sonner";
import {
  bulkActivateCategories,
  bulkDeactivateCategories,
  bulkDeleteCategories,
  loadCategoryItemCounts,
  loadCategoryRows,
} from "@/app/items/categories/actions";
import { CategoryDetailCanvas } from "@/components/categories/category-detail-canvas";
import { CategoryEmptyState } from "@/components/categories/category-empty-state";
import { CategoryMatrixPeekDrawer } from "@/components/categories/category-matrix-peek-drawer";
import { CategoryMatrixRegistryPane } from "@/components/categories/category-matrix-registry-pane";
import {
  CategoryToolbarControls,
  CategoryToolbarCount,
} from "@/components/categories/category-toolbar-controls";
import { CategoriesUnifiedCatalogHeader } from "@/components/categories/categories-unified-catalog-header";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { ListWorkspaceMatrixLayout } from "@/components/layout/list-workspace-matrix-layout";
import {
  ListWorkspaceSplitLayout,
  useListWorkspaceSplitDesktop,
} from "@/components/layout/list-workspace-split-layout";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { useListWorkspace, type ListWorkspaceLayout } from "@/lib/layout/list-workspace";
import { isMutationSurface } from "@/lib/layout/module-drawer-url";
import { filterCategoryListRowsByFeedQuery } from "@/lib/categories/feed-filter";
import { withoutCategoriesWorkspaceDisabledColumns } from "@/lib/categories/category-row-meta";
import { useDeviceClass } from "@/hooks/use-device-class";
import { CATEGORIES_HREF } from "@/lib/categories/category-navigation";
import { enrichCategoryListRows } from "@/lib/categories/list-row";
import {
  AUTO_LAYOUT_PREF,
  getColumnPrefsSlice,
  getDefaultCategoryListPrefs,
  getOrderedVisibleColumns,
  isCategoryTableLikeViewMode,
  loadCategoryListPrefs,
  resolveFrozenColumnCount,
  saveCategoryListPrefs,
  setColumnWidthSlice,
  type CategoryListPrefs,
} from "@/lib/categories/list-prefs";
import type { CategoryListColumnId } from "@/lib/categories/list-columns";
import { sortCategoryListRows, type CategoryListSortDirection, type CategoryListSortField } from "@/lib/categories/list-sort";
import {
  patchCategoryActiveState,
  removeCategoryRow,
  upsertCategoryRow,
} from "@/lib/categories/row-state";
import type { CategoryRow } from "@/lib/categories/types";
import { filterCategoryTree, flattenTree } from "@/lib/categories/tree";
import { useFilteredCategories } from "@/lib/categories/use-filtered-categories";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import { cn } from "@/lib/utils";

const CategoryDrawerForm = lazyClientExport(
  () => import("@/components/categories/category-drawer-form"),
  "CategoryDrawerForm"
);
const CategoryDeleteDialogLazy = lazyClientExport(
  () => import("@/components/categories/category-delete-dialog"),
  "CategoryDeleteDialog"
);
const CategoryBulkDeleteAlertLazy = lazyClientExport(
  () => import("@/components/categories/category-bulk-delete-alert"),
  "CategoryBulkDeleteAlert"
);

const CategoryBulkActionToolbar = lazyClientExport(
  () => import("@/components/categories/category-bulk-action-toolbar"),
  "CategoryBulkActionToolbar"
);

type CategoryBulkToolbarAction = import("@/components/categories/category-bulk-action-toolbar").CategoryBulkToolbarAction;

const CategoryTreePanel = dynamic(
  () =>
    import("@/components/categories/category-tree-panel").then(
      (module) => module.CategoryTreePanel
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-[240px] w-full" />,
  }
);

type Props = {
  initialRows: CategoryRow[];
  itemCountByCategoryId?: Record<string, number>;
  initialSavedView?: SavedViewSnapshot | null;
};

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
  const { setLayout } = useListWorkspace();
  const isSplitDesktop = useListWorkspaceSplitDesktop();
  const drawer = useModuleDrawerUrl(CATEGORIES_HREF, { canonicalizeLegacy: true });
  const omnibar = useOptionalOmnibarContext();
  const serverViewHydratedRef = useRef(false);
  const { deviceClass } = useDeviceClass();
  const [rows, setRows] = useState(initialRows);
  const [rowsLoading, setRowsLoading] = useState(initialRows.length === 0);
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
  const [feedFilterQuery, setFeedFilterQuery] = useState("");

  const handlePrefsChange = useCallback(
    (next: CategoryListPrefs) => {
      setPrefs(next);
      setLayout(next.viewMode === "tree" ? "split" : "matrix");
    },
    [setLayout]
  );

  useEffect(() => {
    if (initialRows.length > 0) return;
    let cancelled = false;
    void loadCategoryRows().then((nextRows) => {
      if (cancelled) return;
      setRows(nextRows);
      setRowsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [initialRows.length]);

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

  const tableViewMode = prefs.viewMode === "table";
  const isTreeView = !tableViewMode;
  const useInlineSplitDetail = isTreeView && isSplitDesktop;
  const workspaceLayout: ListWorkspaceLayout = isTreeView ? "split" : "matrix";

  const listRowById = useMemo(() => {
    const enriched = enrichCategoryListRows(filteredRows, rows, itemCountByCategoryId);
    return new Map(enriched.map((row) => [row.id, row]));
  }, [filteredRows, rows, itemCountByCategoryId]);

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

  const feedFilteredListRows = useMemo(
    () => filterCategoryListRowsByFeedQuery(listRows, feedFilterQuery),
    [listRows, feedFilterQuery]
  );

  const feedFilteredTree = useMemo(() => {
    if (!feedFilterQuery.trim()) return filteredTree;
    return filterCategoryTree(filteredTree, feedFilterQuery);
  }, [filteredTree, feedFilterQuery]);

  const visibleCategoryIds = useMemo(() => {
    if (isCategoryTableLikeViewMode(prefs.viewMode)) {
      return feedFilteredListRows.map((row) => row.id);
    }
    return flattenTree(feedFilteredTree).map((node) => node.id);
  }, [feedFilteredListRows, feedFilteredTree, prefs.viewMode]);

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
      withoutCategoriesWorkspaceDisabledColumns(
        getOrderedVisibleColumns(prefs, deviceClass)
      ),
    [deviceClass, prefs]
  );

  const columnPrefsSlice = getColumnPrefsSlice(prefs, deviceClass);

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

  const handleEditCategory = useCallback(
    (category: CategoryRow) => {
      drawer.openEdit(category.id);
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
    const exportRows = listRows.filter((row) => idSet.has(row.id));
    void import("@/lib/categories/bulk-export").then(({ downloadCategoryListCsv }) => {
      if (exportRows.length === 0) {
        const enriched = enrichCategoryListRows(
          filteredRows.filter((row) => idSet.has(row.id)),
          rows,
          itemCountByCategoryId
        );
        downloadCategoryListCsv(enriched);
      } else {
        downloadCategoryListCsv(exportRows);
      }
      toast.success(`Exported ${ids.length} categor${ids.length === 1 ? "y" : "ies"}.`);
    });
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
    setLayout(prefs.viewMode === "tree" ? "split" : "matrix");
  }, [prefs.viewMode, prefsHydrated, setLayout]);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveCategoryListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const openDelete = (category: CategoryRow) => {
    setPendingDelete(category);
  };

  const catalogEmpty = rows.length === 0;
  const filterEmptyMessage = "No categories match the current filter.";
  const peekDrawerOpen = drawer.isOpen && drawer.surface === "peek";
  const mutationDrawerOpen = drawer.isOpen && isMutationSurface(drawer.surface);
  const usePeekDrawer = !useInlineSplitDetail;

  const toolbarControls = (
    <CategoryToolbarControls
      prefs={prefs}
      onPrefsChange={handlePrefsChange}
      detectedDeviceClass={deviceClass}
      prefsHydrated={prefsHydrated}
      workspaceLayout={workspaceLayout}
    />
  );

  const toolbarCount = (
    <CategoryToolbarCount resultCount={resultCount} totalCount={totalCount} />
  );

  const treePanel = (
    <CategoryTreePanel
      filteredTree={feedFilteredTree}
      totalRows={totalCount}
      listRowById={listRowById}
      metaColumns={visibleColumns}
      selectedId={selectedId}
      bulkSelectedIds={bulkSelectedIds}
      onSelect={handleSelectCategory}
      onBulkRowToggle={handleBulkRowToggle}
    />
  );

  const tablePane = (
    <CategoryMatrixRegistryPane
      rows={feedFilteredListRows}
      columns={visibleColumns}
      columnWrapModes={columnPrefsSlice.columnWrapModes}
      columnChipDisplay={columnPrefsSlice.columnChipDisplay}
      columnWidths={columnPrefsSlice.columnWidths}
      deviceClass={deviceClass}
      selectedId={selectedId}
      onSelect={handleSelectCategory}
      catalogEmpty={catalogEmpty}
      emptyMessage={filterEmptyMessage}
      sortField={prefs.sortField}
      sortDirection={prefs.sortDirection}
      onSortChange={(sortField: CategoryListSortField, sortDirection: CategoryListSortDirection) =>
        handlePrefsChange({ ...prefs, sortField, sortDirection })
      }
      onColumnWidthChange={(columnId: CategoryListColumnId, width: number | null) =>
        handlePrefsChange(setColumnWidthSlice(prefs, deviceClass, columnId, width))
      }
      bulkSelectedIds={bulkSelectedIds}
      onBulkRowToggle={handleBulkRowToggle}
      onBulkPageToggle={handleBulkPageToggle}
      frozenColumnCount={resolveFrozenColumnCount(prefs, deviceClass)}
      freezeColumnsAuto={prefs.frozenColumnCount === AUTO_LAYOUT_PREF}
    />
  );

  const listBody = rowsLoading ? (
    <Skeleton className="h-full min-h-[240px] w-full" />
  ) : catalogEmpty ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <CategoryEmptyState onCreate={drawer.openCreate} hasExistingCategories={false} />
    </div>
  ) : isTreeView ? (
    treePanel
  ) : (
    tablePane
  );

  const peekDrawer = (
    <CategoryMatrixPeekDrawer
      open={peekDrawerOpen && usePeekDrawer}
      category={peekCategory}
      allRows={rows}
      onClose={() => drawer.close()}
      onEdit={handleEditCategory}
      onDelete={openDelete}
    />
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

  const drawerOpen = mutationDrawerOpen;

  return (
    <>
      <ListModuleShell
        catalogBody={useInlineSplitDetail}
        title={
            <CategoriesUnifiedCatalogHeader
              onNewCategory={drawer.openCreate}
              count={toolbarCount}
              controls={toolbarControls}
              layout={workspaceLayout}
              feedFilter={{ value: feedFilterQuery, onChange: setFeedFilterQuery }}
            />
          }
          bulkToolbar={bulkToolbar}
          className="list-module-shell-root"
        >
          {useInlineSplitDetail ? (
            <ListWorkspaceSplitLayout
              detailOpen={peekDrawerOpen}
              mobileDetailOpen={false}
              listPane={
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {listBody}
                </div>
              }
              detailPane={
                <CategoryDetailCanvas
                  category={peekCategory}
                  allRows={rows}
                  onEdit={handleEditCategory}
                  onDelete={openDelete}
                />
              }
            />
          ) : (
            <>
              <ListWorkspaceMatrixLayout>{listBody}</ListWorkspaceMatrixLayout>
              {peekDrawer}
            </>
          )}
        </ListModuleShell>

      {drawerOpen ? (
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
      ) : null}

      {pendingDelete ? (
        <CategoryDeleteDialogLazy
          category={pendingDelete}
          rows={rows}
          itemCountByCategoryId={itemCountByCategoryId}
          open={Boolean(pendingDelete)}
          onOpenChange={(next: boolean) => !next && setPendingDelete(null)}
          onDeleted={handleCategoryDeleted}
          onDeactivated={handleCategoryDeactivated}
        />
      ) : null}

      {bulkDeleteOpen ? (
        <CategoryBulkDeleteAlertLazy
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          onConfirm={runBulkDelete}
        />
      ) : null}
    </>
  );
}
