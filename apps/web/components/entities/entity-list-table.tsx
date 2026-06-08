"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { renderEntityListCell } from "@/components/entities/entity-list-cells";
import { Checkbox } from "@/components/ui/checkbox";
import { getEntityColumnDef, type EntityListColumnId } from "@/lib/entities/list-columns";
import {
  isSortableEntityColumn,
  toggleEntityColumnSort,
  type EntityListSortDirection,
  type EntityListSortField,
} from "@/lib/entities/list-sort";
import type { EntityListRow } from "@/lib/entities/types";
import {
  LIST_TABLE_BODY_CELL,
  LIST_TABLE_HEADER_CELL,
  LIST_TABLE_HEADER_ROW,
  LIST_TABLE_HEADER_SORTABLE,
  LIST_TABLE_SURFACE,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: EntityListRow[];
  columns: EntityListColumnId[];
  columnChipDisplay?: Partial<Record<EntityListColumnId, ColumnChipDisplay>>;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  pageAllSelected: boolean;
  pageSomeSelected: boolean;
  sortField: EntityListSortField;
  sortDirection: EntityListSortDirection;
  compactRows?: boolean;
  onSortChange: (field: EntityListSortField, direction: EntityListSortDirection) => void;
  onSelect: (entityId: string) => void;
  onBulkRowToggle: (entityId: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
};

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: EntityListSortDirection;
}) {
  if (!active) {
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />;
  }
  if (direction === "asc") {
    return <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden />;
  }
  return <ArrowDown className="h-3.5 w-3.5 text-primary" aria-hidden />;
}

export function EntityListTable({
  rows,
  columns,
  columnChipDisplay,
  selectedId,
  bulkSelectedIds,
  pageAllSelected,
  pageSomeSelected,
  sortField,
  sortDirection,
  compactRows = false,
  onSortChange,
  onSelect,
  onBulkRowToggle,
  onBulkPageToggle,
}: Props) {
  const cellPadding = compactRows ? "p-1.5" : "p-2.5";

  return (
    <div className={LIST_TABLE_SURFACE}>
      <div className="h-full min-h-0 overflow-x-auto overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
          <thead className={LIST_TABLE_HEADER_ROW}>
            <tr className="bg-muted text-left">
              <th
                scope="col"
                className={cn(LIST_TABLE_HEADER_CELL, "w-10 text-center")}
                onClick={(event) => event.stopPropagation()}
              >
                <Checkbox
                  checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => onBulkPageToggle(checked === true)}
                  aria-label="Select all listed entities"
                />
              </th>
              {columns.map((columnId) => {
                const column = getEntityColumnDef(columnId);
                const sortable = isSortableEntityColumn(columnId);
                const isActiveSort = sortField === columnId;

                return (
                  <th
                    key={columnId}
                    scope="col"
                    className={cn(
                      LIST_TABLE_HEADER_CELL,
                      sortable && LIST_TABLE_HEADER_SORTABLE,
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                      isActiveSort && "text-foreground"
                    )}
                    aria-sort={
                      sortable
                        ? isActiveSort
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    onClick={() => {
                      if (!sortable) return;
                      const next = toggleEntityColumnSort(columnId, sortField, sortDirection);
                      onSortChange(next.field, next.direction);
                    }}
                  >
                    {sortable ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          column.align === "right" && "justify-end",
                          column.align === "center" && "justify-center"
                        )}
                      >
                        {column.label}
                        <SortIndicator active={isActiveSort} direction={sortDirection} />
                      </span>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="p-6 text-center text-sm text-muted-foreground"
                >
                  No entities match your search.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const selected = selectedId === row.id;
                const bulkSelected = bulkSelectedIds.has(row.id);

                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    role="button"
                    className={cn(
                      listTableRowClass(selected),
                      !row.is_active && "opacity-60"
                    )}
                    onClick={() => onSelect(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(row.id);
                      }
                    }}
                  >
                    <td
                      className={cn(LIST_TABLE_BODY_CELL, cellPadding, "text-center")}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={bulkSelected}
                        onCheckedChange={(checked) =>
                          onBulkRowToggle(row.id, checked === true)
                        }
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                    {columns.map((columnId) => {
                      const column = getEntityColumnDef(columnId);
                      return (
                        <td
                          key={columnId}
                          className={cn(
                            LIST_TABLE_BODY_CELL,
                            cellPadding,
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right tabular-nums"
                          )}
                        >
                          {renderEntityListCell(columnId, row, { chipDisplay: columnChipDisplay })}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
