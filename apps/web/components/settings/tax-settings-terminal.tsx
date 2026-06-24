"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteTaxCode, loadDefaultTaxCodes } from "@/app/settings/tax/actions";
import { TaxCodeDrawerForm } from "@/components/settings/tax-code-drawer-form";
import { TaxDeleteDialog } from "@/components/settings/tax/tax-delete-dialog";
import { TaxEmptyState } from "@/components/settings/tax/tax-empty-state";
import { TaxListToolbar } from "@/components/settings/tax/tax-list-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  getDefaultTaxListPrefs,
  loadTaxListPrefs,
  saveTaxListPrefs,
  setTaxColumnWidth,
  type TaxListPrefs,
} from "@/lib/tax/list-prefs";
import { sortTaxCodeRows, type TaxListSortDirection, type TaxListSortField } from "@/lib/tax/list-sort";
import { TAX_HREF } from "@/lib/tax/navigation";
import { useFilteredTaxCodes } from "@/lib/tax/use-filtered-tax-codes";
import type { TaxListColumnId } from "@/lib/tax/list-columns";
import type { TaxCodeRow } from "@/lib/tax/types";

const TaxListTable = lazyClientExport(
  () => import("@/components/settings/tax/tax-list-table"),
  "TaxListTable"
);

const TAX_PAGE_DESCRIPTION =
  "Define reusable tax rules (flat or value-based slabs). Items reference a rule instead of a typed percentage.";

type Props = {
  initialRows: TaxCodeRow[];
  canEdit: boolean;
};

export function TaxSettingsTerminal({ initialRows, canEdit }: Props) {
  const router = useRouter();
  const drawer = useModuleDrawerUrl(TAX_HREF);
  const [rows, setRows] = useState(initialRows);
  const [prefs, setPrefs] = useState<TaxListPrefs>(getDefaultTaxListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TaxCodeRow | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isLoadingDefaults, startLoadDefaults] = useTransition();

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    setPrefs(loadTaxListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveTaxListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const { filteredRows, totalCount, resultCount } = useFilteredTaxCodes({
    rows,
    activeStatusFilter: prefs.activeStatusFilter,
    kindFilter: prefs.kindFilter,
  });

  const sortedRows = useMemo(
    () => sortTaxCodeRows(filteredRows, prefs.sortField, prefs.sortDirection),
    [filteredRows, prefs.sortDirection, prefs.sortField]
  );

  const peekRow = useMemo(() => {
    if (!drawer.recordId) return null;
    return rows.find((row) => row.id === drawer.recordId) ?? null;
  }, [drawer.recordId, rows]);

  const loadDefaults = useCallback(() => {
    startLoadDefaults(async () => {
      const result = await loadDefaultTaxCodes();
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load default tax rules.");
        return;
      }
      toast.success(
        result.created > 0
          ? `Added ${result.created} default tax rule${result.created === 1 ? "" : "s"} for ${result.countryCode}.`
          : "Default tax rules are already present."
      );
      router.refresh();
    });
  }, [router]);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    startDelete(async () => {
      const result = await deleteTaxCode(target.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to delete tax rule.");
        return;
      }
      toast.success(
        result.outcome === "DEACTIVATED"
          ? "Tax rule is in use — deactivated instead of deleted."
          : "Tax rule deleted."
      );
      setPendingDelete(null);
      setRows((current) =>
        result.outcome === "DEACTIVATED"
          ? current.map((row) =>
              row.id === target.id ? { ...row, is_active: false } : row
            )
          : current.filter((row) => row.id !== target.id)
      );
      if (drawer.recordId === target.id) {
        drawer.close();
      }
      router.refresh();
    });
  }, [drawer, pendingDelete, router]);

  const handleSelectRow = useCallback(
    (row: TaxCodeRow) => {
      drawer.openPeek(row.id);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (taxCodeId: string) => {
      router.refresh();
      drawer.afterSave(taxCodeId);
    },
    [drawer, router]
  );

  const listPrimary =
    rows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <TaxEmptyState
          canEdit={canEdit}
          isLoadingDefaults={isLoadingDefaults}
          onCreate={canEdit ? drawer.openCreate : undefined}
          onLoadDefaults={canEdit ? loadDefaults : undefined}
        />
      </div>
    ) : sortedRows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No tax rules match the current filters.
        </div>
      </div>
    ) : (
      <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
        <TaxListTable
          rows={sortedRows}
          columnPrefs={prefs.columnPrefs}
          sortField={prefs.sortField}
          sortDirection={prefs.sortDirection}
          frozenColumnCount={prefs.frozenColumnCount}
          onSortChange={(field: TaxListSortField, direction: TaxListSortDirection) =>
            setPrefs((current) => ({
              ...current,
              sortField: field,
              sortDirection: direction,
            }))
          }
          onColumnWidthChange={(columnId: TaxListColumnId, width: number | null) =>
            setPrefs((current) => setTaxColumnWidth(current, columnId, width))
          }
          selectedId={drawer.surface === "peek" ? drawer.recordId : null}
          onSelect={handleSelectRow}
        />
      </div>
    );

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Tax settings"
            description={TAX_PAGE_DESCRIPTION}
            createLabel="New tax rule"
            onCreate={canEdit ? drawer.openCreate : undefined}
            aboutAriaLabel="About Tax settings"
          />
        }
        toolbar={
          rows.length > 0 ? (
            <TaxListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              resultCount={resultCount}
              totalCount={totalCount}
              compactCountLabel={drawer.isOpen}
              prefsHydrated={prefsHydrated}
              canEdit={canEdit}
              isLoadingDefaults={isLoadingDefaults}
              onLoadDefaults={loadDefaults}
            />
          ) : null
        }
      >
        {!canEdit ? (
          <div className="mx-1 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            You have read-only access to tax settings. Editing requires the owner or a delegated
            permission.
          </div>
        ) : null}
        <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{listPrimary}</div>
        </div>
      </ListModuleShell>

      {drawer.isOpen ? (
        <TaxCodeDrawerForm
          open={drawer.isOpen}
          surface={drawer.surface}
          row={drawer.surface === "create" ? null : peekRow}
          canEdit={canEdit}
          onClose={drawer.close}
          onAfterSave={handleAfterSave}
          onEdit={
            canEdit && peekRow
              ? () => drawer.openEdit(peekRow.id)
              : undefined
          }
          onDelete={
            canEdit && peekRow
              ? () => setPendingDelete(peekRow)
              : undefined
          }
        />
      ) : null}

      <TaxDeleteDialog
        row={pendingDelete}
        open={Boolean(pendingDelete)}
        isDeleting={isDeleting}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
