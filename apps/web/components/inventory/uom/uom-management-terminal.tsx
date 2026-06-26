"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteUom, seedDefaultUoms } from "@/app/settings/catalogs/uom/actions";
import { UomDeleteDialog } from "@/components/inventory/uom/uom-delete-dialog";
import { UomDrawerForm } from "@/components/inventory/uom/uom-drawer-form";
import { UomEmptyState } from "@/components/inventory/uom/uom-empty-state";
import { UomListToolbar } from "@/components/inventory/uom/uom-list-toolbar";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapUomRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";
import { useActiveTableColumnPrefs } from "@/lib/list-columns/use-active-table-column-prefs";
import {
  getDefaultUomListPrefs,
  loadUomListPrefs,
  saveUomListPrefs,
  setUomColumnWidth,
  type UomListPrefs,
} from "@/lib/uom/list-prefs";
import { sortUomRows, type UomListSortDirection, type UomListSortField } from "@/lib/uom/list-sort";
import { UOM_HREF } from "@/lib/uom/navigation";
import { useFilteredUoms } from "@/lib/uom/use-filtered-uoms";
import type { UomListColumnId } from "@/lib/uom/list-columns";
import type { UomRow } from "@/lib/uom/types";

const UomListTable = lazyClientExport(
  () => import("@/components/inventory/uom/uom-list-table"),
  "UomListTable"
);

type Props = {
  initialRows: UomRow[];
  canManage: boolean;
};

export function UomManagementTerminal({ initialRows, canManage }: Props) {
  const router = useRouter();
  const drawer = useModuleDrawerUrl(UOM_HREF);
  const [rows, setRows] = useState(initialRows);
  const [prefs, setPrefs] = useState<UomListPrefs>(getDefaultUomListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const { deviceClass, slice: activeColumnPrefs } = useActiveTableColumnPrefs(prefs.columnPrefs);
  const [pendingDelete, setPendingDelete] = useState<UomRow | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isSeeding, startSeed] = useTransition();

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    setPrefs(loadUomListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveUomListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const { filteredRows, totalCount, resultCount } = useFilteredUoms({
    rows,
    activeStatusFilter: prefs.activeStatusFilter,
    familyFilter: prefs.familyFilter,
  });

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: filteredRows,
    extractSearchable: (row) => [row.code, row.name, row.family],
  });

  const sortedRows = useMemo(
    () => sortUomRows(feedFilteredRows, prefs.sortField, prefs.sortDirection),
    [feedFilteredRows, prefs.sortDirection, prefs.sortField]
  );

  const peekRow = useMemo(() => {
    if (!drawer.recordId) return null;
    return rows.find((row) => row.id === drawer.recordId) ?? null;
  }, [drawer.recordId, rows]);

  const loadDefaults = useCallback(() => {
    startSeed(async () => {
      const result = await seedDefaultUoms();
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load default units.");
        return;
      }
      toast.success(
        result.created > 0
          ? `Added ${result.created} default unit${result.created === 1 ? "" : "s"}.`
          : "Default units are already present."
      );
      router.refresh();
    });
  }, [router]);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    startDelete(async () => {
      const result = await deleteUom(target.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to delete unit.");
        return;
      }
      toast.success(
        result.outcome === "DEACTIVATED"
          ? "Unit is in use — deactivated instead of deleted."
          : "Unit deleted."
      );
      setPendingDelete(null);
      setRows((current) =>
        result.outcome === "DEACTIVATED"
          ? current.map((row) => (row.id === target.id ? { ...row, is_active: false } : row))
          : current.filter((row) => row.id !== target.id)
      );
      if (drawer.recordId === target.id) {
        drawer.close();
      }
      router.refresh();
    });
  }, [drawer, pendingDelete, router]);

  const handleSelectRow = useCallback(
    (row: UomRow) => {
      drawer.openPeek(row.id);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (uomId: string) => {
      router.refresh();
      drawer.afterSave(uomId);
    },
    [drawer, router]
  );

  const listPrimary =
    rows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <UomEmptyState
          canManage={canManage}
          isLoadingDefaults={isSeeding}
          onCreate={canManage ? drawer.openCreate : undefined}
          onLoadDefaults={canManage ? loadDefaults : undefined}
        />
      </div>
    ) : sortedRows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No units match the current filters.
        </div>
      </div>
    ) : (
      <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
        <UomListTable
          rows={sortedRows}
          columnPrefs={activeColumnPrefs}
          sortField={prefs.sortField}
          sortDirection={prefs.sortDirection}
          frozenColumnCount={prefs.frozenColumnCount}
          onSortChange={(field: UomListSortField, direction: UomListSortDirection) =>
            setPrefs((current) => ({
              ...current,
              sortField: field,
              sortDirection: direction,
            }))
          }
          onColumnWidthChange={(columnId: UomListColumnId, width: number | null) =>
            setPrefs((current) => setUomColumnWidth(current, deviceClass, columnId, width))
          }
          selectedId={drawer.surface === "peek" ? drawer.recordId : null}
          onSelect={handleSelectRow}
        />
      </div>
    );

  const splitListPrimary = buildCatalogSplitListPane({
    rows: sortedRows,
    selectedId: drawer.surface === "peek" ? drawer.recordId : null,
    onSelect: (uomId) => drawer.openPeek(uomId),
    mapRow: mapUomRowToSplitFeed,
    hasAnyData: rows.length > 0,
    emptyMessage: "No units match the current filters.",
    empty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <UomEmptyState
          canManage={canManage}
          isLoadingDefaults={isSeeding}
          onCreate={canManage ? drawer.openCreate : undefined}
          onLoadDefaults={canManage ? loadDefaults : undefined}
        />
      </div>
    ),
    filteredEmpty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No units match the current filters.
        </div>
      </div>
    ),
  });

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
              title="Units of measure"
              count={rows.length > 0 ? `${resultCount}/${totalCount}` : undefined}
              onNew={canManage ? drawer.openCreate : undefined}
              newAriaLabel="New unit"
              layout={layout}
              feedFilter={feedFilterProps}
              controls={
                rows.length > 0 ? (
                  <UomListToolbar
                    prefs={prefs}
                    onPrefsChange={setPrefs}
                    resultCount={resultCount}
                    totalCount={totalCount}
                    prefsHydrated={prefsHydrated}
                    canManage={canManage}
                    isLoadingDefaults={isSeeding}
                    onLoadDefaults={loadDefaults}
                  />
                ) : undefined
              }
            />
          }
        >
          {!canManage ? (
            <div className="mx-1 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              You have read-only access to units of measure. Editing requires an owner or admin
              role.
            </div>
          ) : null}
          <ListWorkspaceCatalogBody
            peekOpen={peekOpen}
            splitEmptyTitle="Select a unit"
            splitEmptyMessage="Choose a row from the list to inspect details here."
            listContent={listPrimary}
            splitListContent={splitListPrimary}
          />
        </ListModuleShell>

        {drawer.isOpen ? (
          <UomDrawerForm
            open={drawer.isOpen}
            surface={drawer.surface}
            row={drawer.surface === "create" ? null : peekRow}
            canManage={canManage}
            onClose={drawer.close}
            onAfterSave={handleAfterSave}
            onEdit={
              canManage && peekRow ? () => drawer.openEdit(peekRow.id) : undefined
            }
            onDelete={
              canManage && peekRow ? () => setPendingDelete(peekRow) : undefined
            }
          />
        ) : null}

        <UomDeleteDialog
          row={pendingDelete}
          open={Boolean(pendingDelete)}
          isDeleting={isDeleting}
          onOpenChange={(next) => !next && setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      </>
    </ListWorkspaceModuleFrame>
  );
}
