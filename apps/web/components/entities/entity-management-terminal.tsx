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
  bulkActivateEntities,
  bulkDeactivateEntities,
  fetchMoreEntities,
  loadEntityCustomFieldDefinitions,
  loadEntityListCategoryRows,
} from "@/app/entities/actions";
import { listRowFromDetail } from "@/lib/entities/list-row";
import { EntityBulkActionToolbar } from "@/components/entities/entity-bulk-action-toolbar";
import type { EntityBulkToolbarAction } from "@/components/entities/entity-bulk-action-toolbar";
import { EntityDeleteDialog } from "@/components/entities/entity-delete-dialog";
import { EntityEmptyState } from "@/components/entities/entity-empty-state";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import {
  EntityListToolbar,
  type EntityActiveStatusFilter,
  type EntityPartyNatureFilter,
} from "@/components/entities/entity-list-toolbar";
import { ListLoadMoreFooter } from "@/components/layout/list-load-more-footer";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { scopeFromModuleName } from "@/lib/search/views/module-view-registry";
import { useDeviceClass } from "@/hooks/use-device-class";
import type { EntityListColumnRegistryKey, EntityListColumnId } from "@/lib/entities/list-columns";
import {
  getColumnPrefsSlice,
  getDefaultEntityListPrefs,
  getOrderedVisibleColumns,
  AUTO_LAYOUT_PREF,
  isEntityTableLikeViewMode,
  loadEntityListPrefs,
  resolveFrozenColumnCount,
  saveEntityListPrefs,
  setColumnWidthSlice,
  type EntityListPrefs,
} from "@/lib/entities/list-prefs";
import { sortEntityListRows, type EntityListSortDirection, type EntityListSortField } from "@/lib/entities/list-sort";
import {
  patchEntityActiveState,
  removeEntityRow,
  upsertEntityRow,
} from "@/lib/entities/row-state";
import type { EntityDetailSnapshot, EntityListRow, EntityWorkspace } from "@/lib/entities/types";
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import type { EntityCategoryRow } from "@/lib/entity-categories/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapEntityListRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";
import { useDocumentListPagination } from "@/lib/documents/use-document-list-pagination";
import { filterEntitiesByAst } from "@/lib/search/executor/client-scopes";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";

const EntityItemDrawer = lazyClientExport(
  () => import("@/components/entities/entity-item-drawer"),
  "EntityItemDrawer"
);

const EntityListCompact = lazyClientExport(
  () => import("@/components/entities/entity-list-compact"),
  "EntityListCompact"
);

const EntityListTable = lazyClientExport(
  () => import("@/components/entities/entity-list-table"),
  "EntityListTable"
);

type Props = {
  workspace: EntityWorkspace;
  tenantId: string;
  customFieldDefinitions?: EntityCustomFieldDefinition[];
  categoryRows?: EntityCategoryRow[];
  initialRows: EntityListRow[];
  initialTotalCount?: number;
  initialHasMore?: boolean;
  initialSavedView?: SavedViewSnapshot | null;
};

function resolveBulkEntityIds(
  bulkSelectAllMatching: boolean,
  bulkSelectedIds: Set<string>,
  matchingIds: string[]
): string[] {
  if (bulkSelectAllMatching) return matchingIds;
  return [...bulkSelectedIds];
}

function useFilteredEntityRows(
  workspace: EntityWorkspace,
  rows: EntityListRow[],
  activeStatusFilter: EntityActiveStatusFilter,
  categoryFilter: string,
  partyNatureFilter: EntityPartyNatureFilter
) {
  const omnibar = useOptionalOmnibarContext();

  return useMemo(() => {
    let filtered = rows.filter((row) => {
      if (activeStatusFilter === "active" && !row.is_active) return false;
      if (activeStatusFilter === "inactive" && row.is_active) return false;
      if (partyNatureFilter !== "all" && row.party_nature !== partyNatureFilter) return false;
      if (categoryFilter !== "all") {
        const categoryId =
          workspace === "customer" ? row.customer_category_id : row.supplier_category_id;
        if (categoryId !== categoryFilter) return false;
      }
      return true;
    });

    if (omnibar?.activeAst?.length) {
      filtered = filterEntitiesByAst(filtered, omnibar.activeAst);
    } else {
      const query = omnibar?.appliedQuery?.trim().toLowerCase() ?? "";
      if (query) {
        filtered = filtered.filter((row) =>
          [
            row.name,
            row.code,
            row.legal_name,
            row.primary_contact_name,
            row.primary_contact_email,
            row.company_email,
            row.customer_category_name,
            row.supplier_category_name,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(query))
        );
      }
    }

    return {
      filteredRows: filtered,
      totalCount: rows.length,
      resultCount: filtered.length,
    };
  }, [
    activeStatusFilter,
    categoryFilter,
    omnibar?.activeAst,
    omnibar?.appliedQuery,
    partyNatureFilter,
    rows,
    workspace,
  ]);
}

export function EntityManagementTerminal({
  workspace,
  tenantId,
  customFieldDefinitions: initialCustomFieldDefinitions = [],
  categoryRows: initialCategoryRows = [],
  initialRows,
  initialTotalCount = initialRows.length,
  initialHasMore = false,
  initialSavedView = null,
}: Props) {
  const config = getEntityWorkspaceConfig(workspace);
  const registryKey: EntityListColumnRegistryKey = config.listColumnRegistryKey;
  const drawer = useModuleDrawerUrl(config.listHref);
  const omnibar = useOptionalOmnibarContext();
  const serverViewHydratedRef = useRef(false);
  const { deviceClass } = useDeviceClass();
  const fetchEntityPage = useCallback(
    (offset: number) => fetchMoreEntities(workspace, offset),
    [workspace]
  );

  const {
    rows,
    setRows,
    totalCount: entityServerTotalCount,
    hasMore: entityHasMore,
    isLoadingMore: entityLoadingMore,
    loadMore: loadMoreEntities,
  } = useDocumentListPagination(
    initialRows,
    initialTotalCount,
    initialHasMore,
    fetchEntityPage,
    config.title.toLowerCase()
  );
  const [categoryRows, setCategoryRows] = useState(initialCategoryRows);
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState(
    initialCustomFieldDefinitions
  );
  const auxiliaryDataRequestedRef = useRef(false);
  const [activeStatusFilter, setActiveStatusFilter] =
    useState<EntityActiveStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [partyNatureFilter, setPartyNatureFilter] =
    useState<EntityPartyNatureFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<EntityListRow | null>(null);
  const [prefs, setPrefs] = useState<EntityListPrefs>(() =>
    getDefaultEntityListPrefs(registryKey)
  );
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    if (auxiliaryDataRequestedRef.current) return;
    auxiliaryDataRequestedRef.current = true;
    void Promise.all([
      loadEntityListCategoryRows(workspace),
      loadEntityCustomFieldDefinitions(workspace),
    ]).then(([nextCategoryRows, nextCustomFieldDefinitions]) => {
      setCategoryRows(nextCategoryRows);
      setCustomFieldDefinitions(nextCustomFieldDefinitions);
    });
  }, [workspace]);

  const { filteredRows, totalCount, resultCount } = useFilteredEntityRows(
    workspace,
    rows,
    activeStatusFilter,
    categoryFilter,
    partyNatureFilter
  );

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: filteredRows,
    extractSearchable: (row) => [
      row.name,
      row.code,
      row.legal_name,
      row.primary_contact_name,
      row.primary_contact_email,
      row.company_email,
      row.customer_category_name,
      row.supplier_category_name,
    ],
  });

  const selectedId = drawer.recordId;
  const peekListRow =
    drawer.recordId != null
      ? (rows.find((row) => row.id === drawer.recordId) ?? null)
      : null;

  const tableViewMode = prefs.viewMode === "compact" ? "compact" : "table";

  const listRows = useMemo(
    () => sortEntityListRows(feedFilteredRows, prefs.sortField, prefs.sortDirection),
    [feedFilteredRows, prefs.sortDirection, prefs.sortField]
  );

  const visibleEntityIds = useMemo(() => listRows.map((row) => row.id), [listRows]);

  const matchingEntityIds = useMemo(
    () => filteredRows.map((row) => row.id),
    [filteredRows]
  );

  const pageAllSelected =
    visibleEntityIds.length > 0 &&
    visibleEntityIds.every((id) => bulkSelectedIds.has(id));
  const pageSomeSelected =
    visibleEntityIds.some((id) => bulkSelectedIds.has(id)) && !pageAllSelected;

  const visibleColumns = useMemo(
    () =>
      isEntityTableLikeViewMode(prefs.viewMode)
        ? getOrderedVisibleColumns(prefs, tableViewMode, deviceClass)
        : [],
    [deviceClass, prefs, tableViewMode]
  );

  const columnPrefsSlice = getColumnPrefsSlice(prefs, tableViewMode, deviceClass);
  const resolvedFrozenColumnCount = resolveFrozenColumnCount(prefs, deviceClass);
  const freezeColumnsAuto = prefs.frozenColumnCount === AUTO_LAYOUT_PREF;

  const bulkSelectionCount = bulkSelectAllMatching
    ? matchingEntityIds.length
    : bulkSelectedIds.size;

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
    setBulkSelectAllMatching(false);
  }, []);

  const resolveSelectedIds = useCallback(
    () =>
      resolveBulkEntityIds(bulkSelectAllMatching, bulkSelectedIds, matchingEntityIds),
    [bulkSelectAllMatching, bulkSelectedIds, matchingEntityIds]
  );

  const handleSelectEntity = useCallback(
    (entityId: string) => {
      drawer.openPeek(entityId);
    },
    [drawer]
  );

  const handleBulkRowToggle = useCallback((entityId: string, checked: boolean) => {
    setBulkSelectAllMatching(false);
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(entityId);
      else next.delete(entityId);
      return next;
    });
  }, []);

  const handleBulkPageToggle = useCallback(
    (checked: boolean) => {
      setBulkSelectAllMatching(false);
      setBulkSelectedIds((current) => {
        const next = new Set(current);
        for (const id of visibleEntityIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [visibleEntityIds]
  );

  const handleBulkSuccess = useCallback(
    (message: string, patch?: (current: EntityListRow[]) => EntityListRow[]) => {
      toast.success(message);
      if (patch) setRows(patch);
      clearBulkSelection();
    },
    [clearBulkSelection]
  );

  const handleEntitySaved = useCallback(
    (entityId: string, entity: EntityDetailSnapshot) => {
      setRows((current) => upsertEntityRow(current, listRowFromDetail(entity)));
      drawer.afterSave(entityId);
    },
    [drawer]
  );

  const handleEntityDeleted = useCallback(
    (entityId: string) => {
      setRows((current) => removeEntityRow(current, entityId));
      if (drawer.recordId === entityId) {
        drawer.close();
      }
      setPendingDelete(null);
      clearBulkSelection();
    },
    [clearBulkSelection, drawer]
  );

  const handleEntityDeactivated = useCallback((entity: EntityListRow) => {
    setRows((current) => upsertEntityRow(current, entity));
  }, []);

  const runBulkActivate = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      toast.error(`Select at least one ${config.singularLabel.toLowerCase()}.`);
      return;
    }
    startBulkTransition(async () => {
      const result = await bulkActivateEntities(ids);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const count = result.affectedIds?.length ?? 0;
      const noun = count === 1 ? config.singularLabel.toLowerCase() : `${config.singularLabel.toLowerCase()}s`;
      handleBulkSuccess(
        `${count} ${noun} activated.`,
        (current) => patchEntityActiveState(current, result.affectedIds ?? [], true)
      );
    });
  }, [config.singularLabel, handleBulkSuccess, resolveSelectedIds]);

  const runBulkDeactivate = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      toast.error(`Select at least one ${config.singularLabel.toLowerCase()}.`);
      return;
    }
    startBulkTransition(async () => {
      const result = await bulkDeactivateEntities(ids);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const count = result.affectedIds?.length ?? 0;
      const noun = count === 1 ? config.singularLabel.toLowerCase() : `${config.singularLabel.toLowerCase()}s`;
      handleBulkSuccess(
        `${count} ${noun} deactivated.`,
        (current) => patchEntityActiveState(current, result.affectedIds ?? [], false)
      );
    });
  }, [config.singularLabel, handleBulkSuccess, resolveSelectedIds]);

  const handleBulkToolbarAction = useCallback(
    (action: EntityBulkToolbarAction) => {
      switch (action) {
        case "activate":
          runBulkActivate();
          break;
        case "deactivate":
          runBulkDeactivate();
          break;
      }
    },
    [runBulkActivate, runBulkDeactivate]
  );

  useLayoutEffect(() => {
    if (!omnibar || serverViewHydratedRef.current) return;
    serverViewHydratedRef.current = true;
    if (initialSavedView) {
      omnibar.hydrateModuleViewFromServer(initialSavedView, null);
      return;
    }
    const scope = scopeFromModuleName(config.savedViewModuleKey);
    if (scope) {
      omnibar.markDefaultViewResolvedOnServer(scope);
    }
  }, [config.savedViewModuleKey, initialSavedView, omnibar]);

  useEffect(() => {
    if (!omnibar?.scopePinnedToAll) return;
    setCategoryFilter("all");
    setPartyNatureFilter("all");
  }, [omnibar?.moduleFilterRevision, omnibar?.scopePinnedToAll]);

  useEffect(() => {
    setPrefs(loadEntityListPrefs(registryKey));
    setPrefsHydrated(true);
  }, [registryKey]);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveEntityListPrefs(registryKey, prefs);
  }, [prefs, prefsHydrated, registryKey]);

  const openDelete = (entity: EntityListRow | EntityDetailSnapshot) => {
    setPendingDelete(
      "contacts" in entity ? listRowFromDetail(entity) : entity
    );
  };

  const listPrimary =
    rows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <EntityEmptyState workspace={workspace} onCreate={drawer.openCreate} />
      </div>
    ) : listRows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No {config.singularLabel.toLowerCase()}s match the current filters.
        </div>
      </div>
    ) : prefs.viewMode === "compact" ? (
      <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
        <EntityListCompact
          rows={listRows}
          columns={visibleColumns}
          columnChipDisplay={columnPrefsSlice.columnChipDisplay}
          selectedId={selectedId}
          bulkSelectedIds={bulkSelectedIds}
          onSelect={handleSelectEntity}
          onBulkRowToggle={handleBulkRowToggle}
        />
        <ListLoadMoreFooter
          visibleCount={rows.length}
          totalCount={entityServerTotalCount}
          hasMore={entityHasMore}
          isLoadingMore={entityLoadingMore}
          onLoadMore={loadMoreEntities}
          noun={config.title.toLowerCase()}
        />
      </div>
    ) : (
      <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
        <EntityListTable
          rows={listRows}
          columns={visibleColumns}
          columnWidths={columnPrefsSlice.columnWidths}
          columnChipDisplay={columnPrefsSlice.columnChipDisplay}
          selectedId={selectedId}
          bulkSelectedIds={bulkSelectedIds}
          pageAllSelected={pageAllSelected}
          pageSomeSelected={pageSomeSelected}
          sortField={prefs.sortField}
          sortDirection={prefs.sortDirection}
          frozenColumnCount={resolvedFrozenColumnCount}
          freezeColumnsAuto={freezeColumnsAuto}
          onSortChange={(sortField: EntityListSortField, sortDirection: EntityListSortDirection) =>
            setPrefs((current) => ({ ...current, sortField, sortDirection }))
          }
          onColumnWidthChange={(columnId: EntityListColumnId, width: number | null) =>
            setPrefs((current) =>
              setColumnWidthSlice(current, tableViewMode, deviceClass, columnId, width)
            )
          }
          onSelect={handleSelectEntity}
          onBulkRowToggle={handleBulkRowToggle}
          onBulkPageToggle={handleBulkPageToggle}
        />
        <ListLoadMoreFooter
          visibleCount={rows.length}
          totalCount={entityServerTotalCount}
          hasMore={entityHasMore}
          isLoadingMore={entityLoadingMore}
          onLoadMore={loadMoreEntities}
          noun={config.title.toLowerCase()}
        />
      </div>
    );

  const listFooter = (
    <ListLoadMoreFooter
      visibleCount={rows.length}
      totalCount={entityServerTotalCount}
      hasMore={entityHasMore}
      isLoadingMore={entityLoadingMore}
      onLoadMore={loadMoreEntities}
      noun={config.title.toLowerCase()}
    />
  );

  const splitListPrimary = buildCatalogSplitListPane({
    rows: listRows,
    selectedId,
    onSelect: handleSelectEntity,
    mapRow: mapEntityListRowToSplitFeed,
    hasAnyData: rows.length > 0,
    emptyMessage: `No ${config.title.toLowerCase()} match the current filters.`,
    footer: listFooter,
    empty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <EntityEmptyState workspace={workspace} onCreate={drawer.openCreate} />
      </div>
    ),
    filteredEmpty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No {config.singularLabel.toLowerCase()}s match the current filters.
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
      <EntityBulkActionToolbar
        workspace={workspace}
        selectedCount={bulkSelectedIds.size}
        totalMatchingCount={matchingEntityIds.length}
        selectAllMatching={bulkSelectAllMatching}
        pageAllSelected={pageAllSelected}
        visibleCount={visibleEntityIds.length}
        isPending={isBulkPending}
        onClearSelection={clearBulkSelection}
        onSelectPage={() => handleBulkPageToggle(true)}
        onSelectAllMatching={() => {
          setBulkSelectAllMatching(true);
          setBulkSelectedIds(new Set(matchingEntityIds));
        }}
        onAction={handleBulkToolbarAction}
        embedded
      />
    ) : null;

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
            count={`${listRows.length}/${totalCount}`}
            onNew={drawer.openCreate}
            newAriaLabel={config.createLabel}
            layout={layout}
            feedFilter={feedFilterProps}
            controls={
              rows.length > 0 ? (
                <EntityListToolbar
                  workspace={workspace}
                  registryKey={registryKey}
                  categoryRows={categoryRows}
                  prefs={prefs}
                  onPrefsChange={setPrefs}
                  activeStatusFilter={activeStatusFilter}
                  onActiveStatusFilterChange={setActiveStatusFilter}
                  categoryFilter={categoryFilter}
                  onCategoryFilterChange={setCategoryFilter}
                  partyNatureFilter={partyNatureFilter}
                  onPartyNatureFilterChange={setPartyNatureFilter}
                  detectedDeviceClass={deviceClass}
                  resultCount={resultCount}
                  totalCount={entityServerTotalCount}
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
          splitEmptyTitle={`Select a ${config.singularLabel.toLowerCase()}`}
          splitEmptyMessage="Choose a row from the list to inspect details here."
          listContent={listPrimary}
          splitListContent={splitListPrimary}
        />
      </ListModuleShell>

      {drawer.isOpen ? (
        <EntityItemDrawer
          workspace={workspace}
          tenantId={tenantId}
          customFieldDefinitions={customFieldDefinitions}
          categoryRows={categoryRows}
          open={drawer.isOpen}
          surface={drawer.surface}
          recordId={drawer.recordId}
          peekListRow={peekListRow}
          onClose={drawer.close}
          onOpenEdit={drawer.openEdit}
          onAfterSave={handleEntitySaved}
          onDelete={(entity: EntityListRow) => openDelete(entity)}
        />
      ) : null}

      <EntityDeleteDialog
        workspace={workspace}
        entity={pendingDelete}
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        onDeleted={handleEntityDeleted}
        onDeactivated={handleEntityDeactivated}
      />
      </>
    </ListWorkspaceModuleFrame>
  );
}
