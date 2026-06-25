"use client";

import { Fragment } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { renderCategoryListCell } from "@/components/categories/category-list-cells";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GLASS_V2_LIST_IMAGE,
  GLASS_V2_LIST_IMAGE_PLACEHOLDER,
} from "@/lib/layout/list-module-chrome";
import { LIST_WORKSPACE_BULK_CHECKBOX_CLASS } from "@/lib/layout/list-table-chrome";
import { buildCategoryRowMetaSegments } from "@/lib/categories/category-row-meta";
import type { CategoryListColumnId } from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";
import type { CategoryTreeNode } from "@/lib/categories/types";
import { cn } from "@/lib/utils";

type Props = {
  node: CategoryTreeNode;
  listRowById: Map<string, CategoryListRow>;
  metaColumns: CategoryListColumnId[];
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  onSelect: (id: string) => void;
  onBulkRowToggle: (id: string, checked: boolean) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
};

export function CategoryTreeNodeRow({
  node,
  listRowById,
  metaColumns,
  selectedId,
  bulkSelectedIds,
  onSelect,
  onBulkRowToggle,
  expandedIds,
  onToggleExpand,
}: Props) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isBulkSelected = bulkSelectedIds.has(node.id);
  const rowInactive = !node.is_active;
  const FolderIcon = isExpanded && hasChildren ? FolderOpen : Folder;
  const listRow = listRowById.get(node.id) ?? null;
  const metaSegments =
    listRow != null ? buildCategoryRowMetaSegments(listRow, metaColumns) : [];

  return (
    <div>
      <div
        className={cn(
          "glass-v2-tree-row flex items-start gap-2 px-2 py-2",
          rowInactive && "glass-v2-tree-row--inactive",
          isSelected && "glass-v2-tree-row--selected"
        )}
        style={{ paddingLeft: `${node.depth * 12 + 8}px` }}
      >
        <div
          className="flex shrink-0 pt-0.5"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
            checked={isBulkSelected}
            onCheckedChange={(checked) => onBulkRowToggle(node.id, checked === true)}
            aria-label={`Select ${node.name}`}
          />
        </div>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label={isExpanded ? "Collapse category" : "Expand category"}
          >
            <ChevronRight
              className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="mt-0.5 inline-block w-5 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left text-sm"
        >
          <span
            className={cn(
              GLASS_V2_LIST_IMAGE,
              GLASS_V2_LIST_IMAGE_PLACEHOLDER,
              "mt-0.5 h-8 w-8 shrink-0"
            )}
            aria-hidden
          >
            <FolderIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="category-tree-row__name block truncate font-medium">{node.name}</span>
            {metaSegments.length > 0 ? (
              <span className="spatial-card-meta mt-0.5 block">
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
          </span>
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <CategoryTreeNodeRow
              key={child.id}
              node={child}
              listRowById={listRowById}
              metaColumns={metaColumns}
              selectedId={selectedId}
              bulkSelectedIds={bulkSelectedIds}
              onSelect={onSelect}
              onBulkRowToggle={onBulkRowToggle}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}
