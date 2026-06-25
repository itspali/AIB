"use client";

import { CategoryMatrixRegistry } from "@/components/categories/category-matrix-registry";
import { CategoryMatrixTable } from "@/components/categories/category-matrix-table";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { DeviceClass } from "@/lib/layout/device-class";
import type { CategoryListColumnId } from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import type {
  CategoryListSortDirection,
  CategoryListSortField,
} from "@/lib/categories/list-sort";
import type { ListFrozenColumnCount } from "@/lib/list-columns/use-frozen-list-columns";

type Props = {
  rows: CategoryListRow[];
  columns: CategoryListColumnId[];
  columnWrapModes?: Partial<Record<CategoryListColumnId, TextWrapMode>>;
  columnChipDisplay?: Partial<Record<CategoryListColumnId, ColumnChipDisplay>>;
  columnWidths?: Partial<Record<CategoryListColumnId, number>>;
  deviceClass: DeviceClass;
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  catalogEmpty: boolean;
  emptyMessage: string;
  sortField: CategoryListSortField;
  sortDirection: CategoryListSortDirection;
  onSortChange: (sortField: CategoryListSortField, sortDirection: CategoryListSortDirection) => void;
  onColumnWidthChange?: (columnId: CategoryListColumnId, width: number | null) => void;
  bulkSelectedIds: Set<string>;
  onBulkRowToggle: (categoryId: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
  frozenColumnCount?: ListFrozenColumnCount;
  freezeColumnsAuto?: boolean;
};

export function CategoryMatrixRegistryPane({
  rows,
  columns,
  columnWrapModes,
  columnChipDisplay,
  columnWidths,
  deviceClass,
  selectedId,
  onSelect,
  catalogEmpty,
  emptyMessage,
  sortField,
  sortDirection,
  onSortChange,
  onColumnWidthChange,
  bulkSelectedIds,
  onBulkRowToggle,
  onBulkPageToggle,
  frozenColumnCount = 0,
  freezeColumnsAuto = false,
}: Props) {
  return (
    <CategoryMatrixRegistry>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          {catalogEmpty
            ? "No categories yet. Create your first category to organize items."
            : emptyMessage}
        </p>
      ) : (
        <CategoryMatrixTable
          rows={rows}
          columns={columns}
          columnWrapModes={columnWrapModes}
          columnChipDisplay={columnChipDisplay}
          columnWidths={columnWidths}
          deviceClass={deviceClass}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          onColumnWidthChange={onColumnWidthChange}
          bulkSelectedIds={bulkSelectedIds}
          onBulkRowToggle={onBulkRowToggle}
          onBulkPageToggle={onBulkPageToggle}
          selectedId={selectedId}
          onSelect={onSelect}
          frozenColumnCount={frozenColumnCount}
          freezeColumnsAuto={freezeColumnsAuto}
        />
      )}
    </CategoryMatrixRegistry>
  );
}
