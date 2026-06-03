"use client";

import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { CategoryTreeNode } from "@/lib/categories/types";
import { cn } from "@/lib/utils";

type Props = {
  node: CategoryTreeNode;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  onSelect: (id: string) => void;
  onBulkRowToggle: (id: string, checked: boolean) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
};

export function CategoryTreeNodeRow({
  node,
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

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-200",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent"
        )}
        style={{ paddingLeft: `${node.depth * 12 + 8}px` }}
      >
        <div onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={isBulkSelected}
            onCheckedChange={(checked) => onBulkRowToggle(node.id, checked === true)}
            aria-label={`Select ${node.name}`}
          />
        </div>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            className="shrink-0 rounded p-0.5 hover:bg-muted"
            aria-label={isExpanded ? "Collapse category" : "Expand category"}
          >
            <ChevronRight
              className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="inline-block w-5 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
        >
          {isExpanded && hasChildren ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        <Badge variant={node.is_active ? "completed" : "locked"}>
          {node.is_active ? "ACTIVE" : "INACTIVE"}
        </Badge>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <CategoryTreeNodeRow
              key={child.id}
              node={child}
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
