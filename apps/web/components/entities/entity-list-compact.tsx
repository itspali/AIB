"use client";

import { renderEntityListCell } from "@/components/entities/entity-list-cells";
import { Checkbox } from "@/components/ui/checkbox";
import { getEntityColumnDef, type EntityListColumnId } from "@/lib/entities/list-columns";
import type { EntityListRow } from "@/lib/entities/types";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: EntityListRow[];
  columns: EntityListColumnId[];
  columnChipDisplay?: Partial<Record<EntityListColumnId, ColumnChipDisplay>>;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  onSelect: (entityId: string) => void;
  onBulkRowToggle: (entityId: string, checked: boolean) => void;
};

export function EntityListCompact({
  rows,
  columns,
  columnChipDisplay,
  selectedId,
  bulkSelectedIds,
  onSelect,
  onBulkRowToggle,
}: Props) {
  const detailColumns = columns.filter((columnId) => columnId !== "name").slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-3 px-0.5 pb-0.5 pt-2 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const selected = selectedId === row.id;
        const bulkSelected = bulkSelectedIds.has(row.id);

        return (
          <article
            key={row.id}
            role="button"
            tabIndex={0}
            className={cn(
              "surface-panel flex min-w-0 cursor-pointer flex-col gap-3 rounded-xl border p-3 text-left transition-colors",
              selected
                ? "border-primary/30 bg-primary/5 ring-1 ring-inset ring-primary/20"
                : "border-border/80 hover:bg-muted/30",
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
            <div className="flex items-start gap-2">
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <Checkbox
                  checked={bulkSelected}
                  onCheckedChange={(checked) => onBulkRowToggle(row.id, checked === true)}
                  aria-label={`Select ${row.name}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                {renderEntityListCell("name", row, { chipDisplay: columnChipDisplay })}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {detailColumns.map((columnId) => {
                const column = getEntityColumnDef(columnId);
                return (
                  <div key={columnId} className="min-w-0">
                    <dt className="text-muted-foreground">{column.label}</dt>
                    <dd className="mt-0.5 truncate font-medium">
                      {renderEntityListCell(columnId, row, { chipDisplay: columnChipDisplay })}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </article>
        );
      })}
    </div>
  );
}
