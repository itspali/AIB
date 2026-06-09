"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Info, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  bulkActivateEntityCategories,
  bulkDeactivateEntityCategories,
  bulkDeleteEntityCategories,
  loadEntityCategoryCounts,
} from "@/app/entities/category-actions";
import { CategoryBulkActionToolbar } from "@/components/categories/category-bulk-action-toolbar";
import type { CategoryBulkToolbarAction } from "@/components/categories/category-bulk-action-toolbar";
import { EntityCategoryBulkDeleteAlert } from "@/components/entity-categories/entity-category-bulk-delete-alert";
import { EntityCategoryDeleteDialog } from "@/components/entity-categories/entity-category-delete-dialog";
import { EntityCategoryDrawerForm } from "@/components/entity-categories/entity-category-drawer-form";
import { EntityCategoryEmptyState } from "@/components/entity-categories/entity-category-empty-state";
import { EntityCategoryListTable } from "@/components/entity-categories/entity-category-list-table";
import { EntityCategoryListToolbar } from "@/components/entity-categories/entity-category-list-toolbar";
import { EntityCategoryTreePanel } from "@/components/entity-categories/entity-category-tree-panel";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeviceClass } from "@/hooks/use-device-class";
import {
  entityCategoryPageDescription,
  getEntityCategoryWorkspaceConfig,
} from "@/lib/entity-categories/config";
import { downloadEntityCategoryListCsv } from "@/lib/entity-categories/bulk-export";
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
import { sortEntityCategoryListRows } from "@/lib/entity-categories/list-sort";
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

function EntityCategoriesPageTitleHeader({
  workspace,
  onNewCategory,
}: {
  workspace: EntityCategoryWorkspace;
  onNewCategory: () => void;
}) {
  const { title } = getEntityCategoryWorkspaceConfig(workspace);
  const description = entityCategoryPageDescription(workspace);

  return (
    <div className="mb-4 flex items-center justify-between gap-2.5 sm:mb-5">
      <div className="flex min-w-0 items-center gap-1.5">
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">{title}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label={`About ${title}`}
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-3">
            <p className="text-sm leading-snug text-muted-foreground">{description}</p>
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

export function EntityCategoryManagementTerminal({
  workspace,
  initialRows,
  entityCountByCategoryId: initialEntityCountByCategoryId = {},
}: Props) {
  const baseHref = entityCategoriesHref(workspace);
  const drawer = useModuleDrawerUrl(baseHref, { canonicalizeLegacy: true });
  const { deviceClass } = useDeviceClass();
  const [rows, setRows] = useState(initialRows);
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
    if (entityCountsRequestedRef.current) return;
    entityCountsRequestedRef.current = true;
    void loadEntityCategoryCounts(workspace).then(setEntityCountByCategoryId);
  }, [workspace]);

  const { filteredTree, filteredRows, totalCount, resultCount } =
    useFilteredEntityCategories(rows);

  const selectedId = drawer.recordId;
  const peekCategory =
    drawer.recordId != null
      ? (rows.find((row) => row.id === drawer.recordId) ?? null)
      : null;

  const tableViewMode: EntityCategoryTableViewMode =
    prefs.viewMode === "compact" ? "compact" : "table";

  const listRows = useMemo(() => {
    const enriched = enrichEntityCategoryListRows(
      filteredRows,
      rows,
      entityCountByCategoryId
    );
    return sortEntityCategoryListRows(enriched, prefs.sortField, prefs.sortDirection);
  }, [
    filteredRows,
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

  const listPrimary =
    rows.length === 0 ? (
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
      <EntityCategoryTreePanel
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
        title={
          <EntityCategoriesPageTitleHeader
            workspace={workspace}
            onNewCategory={drawer.openCreate}
          />
        }
        toolbar={
          rows.length > 0 ? (
            <EntityCategoryListToolbar
              workspace={workspace}
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

      <EntityCategoryDeleteDialog
        workspace={workspace}
        category={pendingDelete}
        rows={rows}
        entityCountByCategoryId={entityCountByCategoryId}
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        onDeleted={handleCategoryDeleted}
        onDeactivated={handleCategoryDeactivated}
      />

      <EntityCategoryBulkDeleteAlert
        workspace={workspace}
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        onConfirm={runBulkDelete}
      />
    </>
  );
}
