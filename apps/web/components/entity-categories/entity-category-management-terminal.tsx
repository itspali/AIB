"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  bulkActivateEntityCategories,
  bulkDeactivateEntityCategories,
  bulkDeleteEntityCategories,
  loadEntityCategoryCounts,
  loadEntityCategoryRows,
} from "@/app/entities/category-actions";
import { EntityCategoryEmptyState } from "@/components/entity-categories/entity-category-empty-state";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { useDeviceClass } from "@/hooks/use-device-class";
import {
  getEntityCategoryWorkspaceConfig,
} from "@/lib/entity-categories/config";
import { enrichEntityCategoryListRows } from "@/lib/entity-categories/list-row";
import {
  getColumnPrefsSlice,
  getDefaultEntityCategoryListPrefs,
  getOrderedVisibleColumns,
  isEntityCategoryTableLikeViewMode,
  loadEntityCategoryListPrefs,
  resolveFrozenColumnCount,
  saveEntityCategoryListPrefs,
  setColumnWidthSlice,
  type EntityCategoryListPrefs,
  type EntityCategoryTableViewMode,
} from "@/lib/entity-categories/list-prefs";
import type { EntityCategoryListColumnId } from "@/lib/entity-categories/list-columns";
import { sortEntityCategoryListRows, type EntityCategoryListSortDirection, type EntityCategoryListSortField } from "@/lib/entity-categories/list-sort";
import { entityCategoriesHref } from "@/lib/entity-categories/navigation";
import {
  patchEntityCategoryActiveState,
  removeEntityCategoryRow,
  upsertEntityCategoryRow,
} from "@/lib/entity-categories/row-state";
import type { EntityCategoryRow, EntityCategoryWorkspace } from "@/lib/entity-categories/types";
import { flattenEntityCategoryTree } from "@/lib/entity-categories/tree";
import { useFilteredEntityCategories } from "@/lib/entity-categories/use-filtered-entity-categories";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapEntityCategoryListRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";

const EntityCategoryDrawerForm = lazyClientExport(
  () => import("@/components/entity-categories/entity-category-drawer-form"),
  "EntityCategoryDrawerForm"
);
const EntityCategoryDeleteDialogLazy = lazyClientExport(
  () => import("@/components/entity-categories/entity-category-delete-dialog"),
  "EntityCategoryDeleteDialog"
);
const EntityCategoryBulkDeleteAlertLazy = lazyClientExport(
  () => import("@/components/entity-categories/entity-category-bulk-delete-alert"),
  "EntityCategoryBulkDeleteAlert"
);

const EntityCategoryListTable = lazyClientExport(
  () => import("@/components/entity-categories/entity-category-list-table"),
  "EntityCategoryListTable"
);

const EntityCategoryListToolbar = lazyClientExport(
  () => import("@/components/entity-categories/entity-category-list-toolbar"),
  "EntityCategoryListToolbar"
);

const CategoryBulkActionToolbar = lazyClientExport(
  () => import("@/components/categories/category-bulk-action-toolbar"),
  "CategoryBulkActionToolbar"
);

type CategoryBulkToolbarAction = import("@/components/categories/category-bulk-action-toolbar").CategoryBulkToolbarAction;

const EntityCategoryTreePanel = dynamic(
  () =>
    import("@/components/entity-categories/entity-category-tree-panel").then(
      (module) => module.EntityCategoryTreePanel
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-[240px] w-full" />,
  }
);

type Props = {
  workspace: EntityCategoryWorkspace;
  initialRows: EntityCategoryRow[];
  entityCountByCategoryId?: Record<string, number>;
};

function resolveBulkCategoryIds(
  bulkSelectAllMatching: boolean,
  bulkSelectedIds: Set<string>,
  matchingIds: string[]
): string[] {
  if (bulkSelectAllMatching) return matchingIds;
  return [...bulkSelectedIds];
}

export function EntityCategoryManagementTerminal({
  workspace,
  initialRows,
  entityCountByCategoryId: initialEntityCountByCategoryId = {},
}: Props) {
  const config = getEntityCategoryWorkspaceConfig(workspace);
  const baseHref = entityCategoriesHref(workspace);
  const drawer = useModuleDrawerUrl(baseHref, { canonicalizeLegacy: true });
  const { deviceClass } = useDeviceClass();
  const [rows, setRows] = useState(initialRows);
  const [rowsLoading, setRowsLoading] = useState(initialRows.length === 0);
  const [entityCountByCategoryId, setEntityCountByCategoryId] = useState(
    initialEntityCountByCategoryId
  );
  const entityCountsRequestedRef = useRef(
    Object.keys(initialEntityCountByCategoryId).length > 0
  );
  const [pendingDelete, setPendingDelete] = useState<EntityCategoryRow | null>(null);
  const [prefs, setPrefs] = useState<EntityCategoryListPrefs>(() =>
    getDefaultEntityCategoryListPrefs(workspace)
  );
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    if (initialRows.length > 0) return;
    let cancelled = false;
    void loadEntityCategoryRows(workspace).then((nextRows) => {
      if (cancelled) return;
      setRows(nextRows);
      setRowsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [initialRows.length, workspace]);

  useEffect(() => {
    if (entityCountsRequestedRef.current) return;
    entityCountsRequestedRef.current = true;
    void loadEntityCategoryCounts(workspace).then(setEntityCountByCategoryId);
  }, [workspace]);

  const { filteredTree, filteredRows, totalCount, resultCount } =
    useFilteredEntityCategories(rows);

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: filteredRows,
    extractSearchable: (row) => [
      row.name,
      row.parent_id ? rows.find((parent) => parent.id === row.parent_id)?.name : undefined,
    ],
  });

  const selectedId = drawer.recordId;
  const peekCategory =
    drawer.recordId != null
      ? (rows.find((row) => row.id === drawer.recordId) ?? null)
      : null;

  const tableViewMode: EntityCategoryTableViewMode =
    prefs.viewMode === "compact" ? "compact" : "table";

  const listRows = useMemo(() => {
    const enriched = enrichEntityCategoryListRows(
      feedFilteredRows,
      rows,
      entityCountByCategoryId
    );
    return sortEntityCategoryListRows(enriched, prefs.sortField, prefs.sortDirection);
  }, [
    feedFilteredRows,
    rows,
    entityCountByCategoryId,
    prefs.sortDirection,
    prefs.sortField,
  ]);

  const visibleCategoryIds = useMemo(() => {
    if (isEntityCategoryTableLikeViewMode(prefs.viewMode)) {
      return listRows.map((row) => row.id);
    }
    return flattenEntityCategoryTree(filteredTree).map((node) => node.id);
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
      isEntityCategoryTableLikeViewMode(prefs.viewMode)
        ? getOrderedVisibleColumns(workspace, prefs, tableViewMode, deviceClass)
        : [],
    [deviceClass, prefs, tableViewMode, workspace]
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
    (message: string, patch?: (current: EntityCategoryRow[]) => EntityCategoryRow[]) => {
      toast.success(message);
      if (patch) setRows(patch);
      clearBulkSelection();
      setBulkDeleteOpen(false);
    },
    [clearBulkSelection]
  );

  const handleCategorySaved = useCallback(
    (categoryId: string, category: EntityCategoryRow) => {
      setRows((current) => upsertEntityCategoryRow(current, category));
      drawer.afterSave(categoryId);
    },
    [drawer]
  );

  const handleCategoryDeleted = useCallback(
    (categoryId: string) => {
      setRows((current) => removeEntityCategoryRow(current, categoryId));
      setEntityCountByCategoryId((current) => {
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

  const handleCategoryDeactivated = useCallback((category: EntityCategoryRow) => {
    setRows((current) => upsertEntityCategoryRow(current, category));
  }, []);

  const runBulkActivate = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      toast.error("Select at least one category.");
      return;
    }
    startBulkTransition(async () => {
      const result = await bulkActivateEntityCategories(workspace, ids);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const count = result.affectedIds?.length ?? 0;
      handleBulkSuccess(
        `${count} categor${count === 1 ? "y" : "ies"} activated.`,
        (current) => patchEntityCategoryActiveState(current, result.affectedIds ?? [], true)
      );
    });
  }, [handleBulkSuccess, resolveSelectedIds, workspace]);

  const runBulkDeactivate = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      toast.error("Select at least one category.");
      return;
    }
    startBulkTransition(async () => {
      const result = await bulkDeactivateEntityCategories(workspace, ids);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const count = result.affectedIds?.length ?? 0;
      handleBulkSuccess(
        `${count} categor${count === 1 ? "y" : "ies"} deactivated.`,
        (current) => patchEntityCategoryActiveState(current, result.affectedIds ?? [], false)
      );
    });
  }, [handleBulkSuccess, resolveSelectedIds, workspace]);

  const runBulkDelete = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      toast.error("Select at least one category.");
      return;
    }
    startBulkTransition(async () => {
      const result = await bulkDeleteEntityCategories(workspace, ids);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const deletedCount = result.deletedIds?.length ?? 0;
      const { entityNounPlural } = getEntityCategoryWorkspaceConfig(workspace);
      if (result.skippedCount && result.skippedCount > 0) {
        toast.warning(
          `Deleted ${deletedCount}; ${result.skippedCount} could not be deleted (children or assigned ${entityNounPlural}).`
        );
      } else {
        toast.success(
          `Deleted ${deletedCount} categor${deletedCount === 1 ? "y" : "ies"}.`
        );
      }
      setRows((current) =>
        result.deletedIds?.reduce(
          (next, categoryId) => removeEntityCategoryRow(next, categoryId),
          current
        ) ?? current
      );
      setEntityCountByCategoryId((current) => {
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
  }, [clearBulkSelection, drawer, resolveSelectedIds, workspace]);

  const runBulkExport = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      toast.error("Select at least one category.");
      return;
    }
    const idSet = new Set(ids);
    const exportRows = listRows.filter((row) => idSet.has(row.id));
    void import("@/lib/entity-categories/bulk-export").then(({ downloadEntityCategoryListCsv }) => {
      if (exportRows.length === 0) {
        const enriched = enrichEntityCategoryListRows(
          filteredRows.filter((row) => idSet.has(row.id)),
          rows,
          entityCountByCategoryId
        );
        downloadEntityCategoryListCsv(workspace, enriched);
      } else {
        downloadEntityCategoryListCsv(workspace, exportRows);
      }
      toast.success(`Exported ${ids.length} categor${ids.length === 1 ? "y" : "ies"}.`);
    });
  }, [filteredRows, rows, entityCountByCategoryId, listRows, resolveSelectedIds, workspace]);

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

  useEffect(() => {
    setPrefs(loadEntityCategoryListPrefs(workspace));
    setPrefsHydrated(true);
  }, [workspace]);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveEntityCategoryListPrefs(workspace, prefs);
  }, [prefs, prefsHydrated, workspace]);

  const openDelete = (category: EntityCategoryRow) => {
    setPendingDelete(category);
  };

  const listPrimary = rowsLoading ? (
    <Skeleton className="h-full min-h-[240px] w-full" />
  ) : rows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <EntityCategoryEmptyState workspace={workspace} onCreate={drawer.openCreate} />
      </div>
    ) : isEntityCategoryTableLikeViewMode(prefs.viewMode) ? (
      <EntityCategoryListTable
        workspace={workspace}
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
        onSortChange={(sortField: EntityCategoryListSortField, sortDirection: EntityCategoryListSortDirection) =>
          setPrefs((current) => ({ ...current, sortField, sortDirection }))
        }
        onColumnWidthChange={(columnId: EntityCategoryListColumnId, width: number | null) =>
          setPrefs((current) =>
            setColumnWidthSlice(current, tableViewMode, deviceClass, columnId, width)
          )
        }
        onSelect={handleSelectCategory}
        onBulkRowToggle={handleBulkRowToggle}
        onBulkPageToggle={handleBulkPageToggle}
      />
    ) : (
      <EntityCategoryTreePanel
        filteredTree={filteredTree}
        totalRows={totalCount}
        selectedId={selectedId}
        bulkSelectedIds={bulkSelectedIds}
        onSelect={handleSelectCategory}
        onBulkRowToggle={handleBulkRowToggle}
      />
    );

  const body = listPrimary;

  const splitListPrimary = buildCatalogSplitListPane({
    rows: listRows,
    selectedId,
    onSelect: handleSelectCategory,
    mapRow: mapEntityCategoryListRowToSplitFeed,
    hasAnyData: rows.length > 0,
    emptyMessage: "No categories match the current filters.",
    loading: rowsLoading ? (
      <Skeleton className="h-full min-h-[240px] w-full" />
    ) : undefined,
    empty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <EntityCategoryEmptyState workspace={workspace} onCreate={drawer.openCreate} />
      </div>
    ),
    filteredEmpty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No categories match the current filters.
        </div>
      </div>
    ),
    bulkEnabled: true,
    bulkSelectedIds,
    pageAllSelected,
    pageSomeSelected,
    onBulkRowToggle: handleBulkRowToggle,
    onBulkPageToggle: handleBulkPageToggle,
  });

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
  const peekOpen = drawer.isOpen && drawer.surface === "peek";
  const { layout } = useListWorkspaceCatalogLayout();

  return (
    <ListWorkspaceModuleFrame peekOpen={peekOpen}>
      <>
      <ListModuleShell
        surface="classic"
        className="list-module-shell-root"
        title={
          <UnifiedCatalogHeader
            title={config.title}
            count={`${resultCount}/${totalCount}`}
            onNew={drawer.openCreate}
            newAriaLabel={`New ${config.titleSingular.toLowerCase()}`}
            layout={layout}
            feedFilter={feedFilterProps}
            controls={
              rows.length > 0 ? (
                <EntityCategoryListToolbar
                  workspace={workspace}
                  prefs={prefs}
                  onPrefsChange={setPrefs}
                  detectedDeviceClass={deviceClass}
                  resultCount={resultCount}
                  totalCount={totalCount}
                  compactCountLabel={drawer.isOpen}
                  hideCount
                  prefsHydrated={prefsHydrated}
                />
              ) : undefined
            }
          />
        }
        bulkToolbar={bulkToolbar}
      >
        <ListWorkspaceCatalogBody
          peekOpen={peekOpen}
          splitEmptyTitle={`Select a ${config.titleSingular.toLowerCase()}`}
          splitEmptyMessage="Choose a row from the list to inspect details here."
          listContent={body}
          splitListContent={splitListPrimary}
        />
      </ListModuleShell>

      {drawerOpen ? (
        <EntityCategoryDrawerForm
          workspace={workspace}
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
        <EntityCategoryDeleteDialogLazy
          workspace={workspace}
          category={pendingDelete}
          rows={rows}
          entityCountByCategoryId={entityCountByCategoryId}
          open={Boolean(pendingDelete)}
          onOpenChange={(next: boolean) => !next && setPendingDelete(null)}
          onDeleted={handleCategoryDeleted}
          onDeactivated={handleCategoryDeactivated}
        />
      ) : null}

      {bulkDeleteOpen ? (
        <EntityCategoryBulkDeleteAlertLazy
          workspace={workspace}
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          onConfirm={runBulkDelete}
        />
      ) : null}
      </>
    </ListWorkspaceModuleFrame>
  );
}
