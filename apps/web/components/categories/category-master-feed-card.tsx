"use client";

import { Fragment, useMemo } from "react";
import { Folder } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GLASS_V2_LIST_IMAGE,
  GLASS_V2_LIST_IMAGE_PLACEHOLDER,
} from "@/lib/layout/list-module-chrome";
import { LIST_WORKSPACE_BULK_CHECKBOX_CLASS } from "@/lib/layout/list-table-chrome";
import { buildCategoryRowMetaSegments } from "@/lib/categories/category-row-meta";
import type { CategoryListColumnId } from "@/lib/categories/list-columns";
import { renderCategoryListCell } from "@/components/categories/category-list-cells";
import type { CategoryListRow } from "@/lib/categories/list-row";
import { cn } from "@/lib/utils";

type Props = {
  row: CategoryListRow;
  columns: CategoryListColumnId[];
  active: boolean;
  bulkSelected?: boolean;
  onSelect: () => void;
  onBulkToggle?: (checked: boolean) => void;
};

export function CategoryMasterFeedCard({
  row,
  columns,
  active,
  bulkSelected = false,
  onSelect,
  onBulkToggle,
}: Props) {
  const metaSegments = useMemo(
    () => buildCategoryRowMetaSegments(row, columns),
    [columns, row]
  );
  const bulkEnabled = Boolean(onBulkToggle);
  const rowInactive = !row.is_active;

  return (
    <div
      className={cn(
        "spatial-master-card-row flex items-start gap-2",
        rowInactive && "spatial-master-card-row--inactive",
        active && "spatial-master-card-row--active"
      )}
    >
      {bulkEnabled ? (
        <div
          className="spatial-master-card-checkbox--with-image flex shrink-0 pl-1"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Checkbox
            className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
            checked={bulkSelected}
            onCheckedChange={(checked) => onBulkToggle?.(checked === true)}
            aria-label={`Select ${row.name}`}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={onSelect}
        className="spatial-master-card spatial-master-card--with-image min-w-0 flex-1"
      >
        <div className="spatial-master-card-image-cell">
          <span
            className={cn(
              GLASS_V2_LIST_IMAGE,
              GLASS_V2_LIST_IMAGE_PLACEHOLDER,
              "spatial-master-card-image !h-full !w-full shrink-0 overflow-hidden"
            )}
            aria-hidden
          >
            <Folder className="h-4 w-4" />
          </span>
        </div>
        <div className="spatial-master-card-name-cell min-w-0">
          <div className="spatial-card-top-row">
            <span className="spatial-card-name truncate">{row.name}</span>
          </div>
        </div>
        {metaSegments.length > 0 ? (
          <span className="spatial-card-meta spatial-master-card-meta-cell">
            {metaSegments.map((segment, index) => (
              <Fragment key={segment.columnId}>
                {index > 0 ? <span aria-hidden="true"> • </span> : null}
                <span>
                  {segment.label}: {renderCategoryListCell(segment.columnId, segment.row)}
                </span>
              </Fragment>
            ))}
          </span>
        ) : null}
      </button>
    </div>
  );
}
