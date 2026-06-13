"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  buildPoCatalogWritebackRows,
  formatWritebackCatalogValue,
  groupPoCatalogWritebackRows,
  PO_CATALOG_WRITEBACK_FIELDS,
  resolveWritebackBulkCheckboxState,
  writebackColumnSelectableIds,
  writebackGroupSelectableIds,
  type PoCatalogWritebackField,
  type PoCatalogWritebackGroup,
  type PoCatalogWritebackRow,
} from "@/lib/procurement/purchase-orders/po-catalog-writeback";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  lines: PoDraftLine[];
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (selectedRows: PoCatalogWritebackRow[]) => void;
  onSkip: () => void;
};

function WritebackFieldCell({
  row,
  checked,
  disabled,
  onToggle,
}: {
  row: PoCatalogWritebackRow | undefined;
  checked: boolean;
  disabled?: boolean;
  onToggle: (checked: boolean) => void;
}) {
  if (!row) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }

  return (
    <label className="flex min-w-0 cursor-pointer items-start gap-2">
      <Checkbox
        className="mt-0.5 shrink-0"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onToggle(value === true)}
        aria-label={`Update ${row.fieldLabel} for ${row.itemName}`}
      />
      <span className="min-w-0 text-xs leading-tight text-muted-foreground">
        {formatWritebackCatalogValue(row.catalogValue)}
        <span aria-hidden className="px-1">
          →
        </span>
        <span className="font-medium text-foreground">{row.proposedValue}</span>
      </span>
    </label>
  );
}

function BulkCheckbox({
  checked,
  disabled,
  ariaLabel,
  onToggle,
}: {
  checked: boolean | "indeterminate";
  disabled?: boolean;
  ariaLabel: string;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onCheckedChange={(value) => onToggle(value === true)}
    />
  );
}

export function PoCatalogWritebackDialog({
  open,
  lines,
  isPending = false,
  onOpenChange,
  onApply,
  onSkip,
}: Props) {
  const groups = useMemo(
    () => groupPoCatalogWritebackRows(buildPoCatalogWritebackRows(lines)),
    [lines]
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) setSelectedIds(new Set());
  }, [open]);

  const setMany = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const flatRows = useMemo(
    () =>
      groups.flatMap((group) =>
        PO_CATALOG_WRITEBACK_FIELDS.map(({ field }) => group.fields[field]).filter(
          (row): row is PoCatalogWritebackRow => row != null
        )
      ),
    [groups]
  );
  const selectedRows = flatRows.filter((row) => selectedIds.has(row.id));
  const allSelectableIds = flatRows.map((row) => row.id);

  const columnTemplate = `2rem minmax(0, 1.35fr) repeat(${PO_CATALOG_WRITEBACK_FIELDS.length}, minmax(0, 1fr))`;

  const toggleColumn = (field: PoCatalogWritebackField, checked: boolean) => {
    setMany(writebackColumnSelectableIds(groups, field), checked);
  };

  const toggleGroup = (group: PoCatalogWritebackGroup, checked: boolean) => {
    setMany(writebackGroupSelectableIds(group), checked);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-4xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Update item master from this purchase order?</AlertDialogTitle>
          <AlertDialogDescription>
            Review proposed catalog changes from paid PO lines. Free goods lines are not included.
            Use row or column selectors to bulk-tick fields, then apply only what you want written
            back to the item master and supplier catalog.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No catalog differences were detected.</p>
        ) : (
          <div className="max-h-[min(50vh,24rem)] overflow-auto pr-1">
            <div
              className="grid items-end gap-x-3 gap-y-1 border-b border-border pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              style={{ gridTemplateColumns: columnTemplate }}
            >
              <BulkCheckbox
                checked={resolveWritebackBulkCheckboxState(allSelectableIds, selectedIds)}
                disabled={isPending || allSelectableIds.length === 0}
                ariaLabel="Select all catalog updates"
                onToggle={(checked) => setMany(allSelectableIds, checked)}
              />
              <div>Item</div>
              {PO_CATALOG_WRITEBACK_FIELDS.map(({ field, shortLabel }) => {
                const columnIds = writebackColumnSelectableIds(groups, field);
                return (
                  <div key={field} className="flex min-w-0 flex-col gap-1">
                    <span>{shortLabel}</span>
                    <BulkCheckbox
                      checked={resolveWritebackBulkCheckboxState(columnIds, selectedIds)}
                      disabled={isPending || columnIds.length === 0}
                      ariaLabel={`Select all ${shortLabel} updates`}
                      onToggle={(checked) => toggleColumn(field, checked)}
                    />
                  </div>
                );
              })}
            </div>
            <ul className="divide-y divide-border">
              {groups.map((group) => {
                const groupIds = writebackGroupSelectableIds(group);
                return (
                  <li
                    key={group.id}
                    className="grid items-start gap-x-3 gap-y-2 py-3"
                    style={{ gridTemplateColumns: columnTemplate }}
                  >
                    <div className="pt-0.5">
                      <BulkCheckbox
                        checked={resolveWritebackBulkCheckboxState(groupIds, selectedIds)}
                        disabled={isPending || groupIds.length === 0}
                        ariaLabel={`Select all updates for ${group.itemName}`}
                        onToggle={(checked) => toggleGroup(group, checked)}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {group.itemName}
                      </div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {group.variantSku}
                      </div>
                    </div>
                    {PO_CATALOG_WRITEBACK_FIELDS.map(({ field }) => {
                      const row = group.fields[field];
                      return (
                        <div key={field} className={cn("min-w-0", !row && "self-center")}>
                          <WritebackFieldCell
                            row={row}
                            checked={row ? selectedIds.has(row.id) : false}
                            disabled={isPending}
                            onToggle={(checked) => {
                              if (row) toggleOne(row.id, checked);
                            }}
                          />
                        </div>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} onClick={onSkip}>
            Skip
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending || selectedRows.length === 0}
            onClick={(event) => {
              event.preventDefault();
              onApply(selectedRows);
            }}
          >
            Update selected
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
