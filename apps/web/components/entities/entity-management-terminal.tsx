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
import { bulkActivateEntities, bulkDeactivateEntities } from "@/app/entities/actions";
import { listRowFromDetail } from "@/lib/entities/list-row";
import { EntityBulkActionToolbar } from "@/components/entities/entity-bulk-action-toolbar";
import type { EntityBulkToolbarAction } from "@/components/entities/entity-bulk-action-toolbar";
import { EntityDeleteDialog } from "@/components/entities/entity-delete-dialog";
import { EntityEmptyState } from "@/components/entities/entity-empty-state";
import { EntityItemDrawer } from "@/components/entities/entity-item-drawer";
import { EntityListCompact } from "@/components/entities/entity-list-compact";
import { EntityListTable } from "@/components/entities/entity-list-table";
import {
  EntityListToolbar,
  type EntityActiveStatusFilter,
} from "@/components/entities/entity-list-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { useDeviceClass } from "@/hooks/use-device-class";
import type { EntityListColumnRegistryKey } from "@/lib/entities/list-columns";
import {
  getColumnPrefsSlice,
  getDefaultEntityListPrefs,
  getOrderedVisibleColumns,
  isEntityTableLikeViewMode,
  loadEntityListPrefs,
  saveEntityListPrefs,
  type EntityListPrefs,
} from "@/lib/entities/list-prefs";
import { sortEntityListRows } from "@/lib/entities/list-sort";
import {
  patchEntityActiveState,
  removeEntityRow,
  upsertEntityRow,
} from "@/lib/entities/row-state";
import type { EntityDetailSnapshot, EntityListRow, EntityWorkspace } from "@/lib/entities/types";
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";

type Props = {
  workspace: EntityWorkspace;
  tenantId: string;
  customFieldDefinitions: EntityCustomFieldDefinition[];
  initialRows: EntityListRow[];
  initialTotalCount?: number;
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
  rows: EntityListRow[],
  activeStatusFilter: EntityActiveStatusFilter
) {
  const omnibar = useOptionalOmnibarContext();

  return useMemo(() => {
    const query = omnibar?.appliedQuery?.trim().toLowerCase() ?? "";

    const filtered = rows.filter((row) => {
      if (activeStatusFilter === "active" && !row.is_active) return false;
      if (activeStatusFilter === "inactive" && row.is_active) return false;
      if (!query) return true;

      return [
        row.name,
        row.code,
        row.legal_name,
        row.primary_contact_name,
        row.primary_contact_email,
        row.company_email,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });

    return {
      filteredRows: filtered,
      totalCount: rows.length,
      resultCount: filtered.length,
    };
  }, [activeStatusFilter, omnibar?.appliedQuery, rows]);
}

export function EntityManagementTerminal({
  workspace,
  tenantId,
  customFieldDefinitions,
  initialRows,
  initialTotalCount,
  initialSavedView = null,
}: Props) {
  const config = getEntityWorkspaceConfig(workspace);
  const registryKey: EntityListColumnRegistryKey = config.listColumnRegistryKey;
  const drawer = useModuleDrawerUrl(config.listHref);
  const omnibar = useOptionalOmnibarContext();
  const serverViewHydratedRef = useRef(false);
  const { deviceClass } = useDeviceClass();

  const [rows, setRows] = useState(initialRows);
  const [activeStatusFilter, setActiveStatusFilter] =
    useState<EntityActiveStatusFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<EntityListRow | null>(null);
  const [prefs, setPrefs] = useState<EntityListPrefs>(() =>
    getDefaultEntityListPrefs(registryKey)
  );
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  const { filteredRows, totalCount, resultCount } = useFilteredEntityRows(
    rows,
    activeStatusFilter
  );

  const selectedId = drawer.recordId;
  const peekListRow =
    drawer.recordId != null
      ? (rows.find((row) => row.id === drawer.recordId) ?? null)
      : null;

  const tableViewMode = prefs.viewMode === "compact" ? "compact" : "table";

  const listRows = useMemo(
    () => sortEntityListRows(filteredRows, prefs.sortField, prefs.sortDirection),
    [filteredRows, prefs.sortDirection, prefs.sortField]
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
    }
  }, [config.savedViewModuleKey, initialSavedView, omnibar]);

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
      <EntityListCompact
        rows={listRows}
        columns={visibleColumns}
        columnChipDisplay={columnPrefsSlice.columnChipDisplay}
        selectedId={selectedId}
        bulkSelectedIds={bulkSelectedIds}
        onSelect={handleSelectEntity}
        onBulkRowToggle={handleBulkRowToggle}
      />
    ) : (
      <EntityListTable
        rows={listRows}
        columns={visibleColumns}
        columnChipDisplay={columnPrefsSlice.columnChipDisplay}
        selectedId={selectedId}
        bulkSelectedIds={bulkSelectedIds}
        pageAllSelected={pageAllSelected}
        pageSomeSelected={pageSomeSelected}
        sortField={prefs.sortField}
        sortDirection={prefs.sortDirection}
        onSortChange={(sortField, sortDirection) =>
          setPrefs((current) => ({ ...current, sortField, sortDirection }))
        }
        onSelect={handleSelectEntity}
        onBulkRowToggle={handleBulkRowToggle}
        onBulkPageToggle={handleBulkPageToggle}
      />
    );

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

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title={config.title}
            description={config.description}
            createLabel={config.createLabel}
            onCreate={drawer.openCreate}
            aboutAriaLabel={`About ${config.title}`}
          />
        }
        toolbar={
          rows.length > 0 ? (
            <EntityListToolbar
              workspace={workspace}
              registryKey={registryKey}
              prefs={prefs}
              onPrefsChange={setPrefs}
              activeStatusFilter={activeStatusFilter}
              onActiveStatusFilterChange={setActiveStatusFilter}
              detectedDeviceClass={deviceClass}
              resultCount={resultCount}
              totalCount={initialTotalCount ?? totalCount}
              compactCountLabel={drawer.isOpen}
              prefsHydrated={prefsHydrated}
            />
          ) : null
        }
        bulkToolbar={bulkToolbar}
      >
        <div className="flex h-full min-h-0 flex-1 basis-0 flex-col overflow-auto">
          {listPrimary}
        </div>
      </ListModuleShell>

      <EntityItemDrawer
        workspace={workspace}
        tenantId={tenantId}
        customFieldDefinitions={customFieldDefinitions}
        open={drawer.isOpen}
        surface={drawer.surface}
        recordId={drawer.recordId}
        peekListRow={peekListRow}
        onClose={drawer.close}
        onOpenEdit={drawer.openEdit}
        onAfterSave={handleEntitySaved}
        onDelete={(entity) => openDelete(entity)}
      />

      <EntityDeleteDialog
        workspace={workspace}
        entity={pendingDelete}
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        onDeleted={handleEntityDeleted}
        onDeactivated={handleEntityDeactivated}
      />
    </>
  );
}
