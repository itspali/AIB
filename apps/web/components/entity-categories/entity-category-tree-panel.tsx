"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { EntityCategoryTreeNode } from "@/lib/entity-categories/types";
import { collectExpandableEntityCategoryIds } from "@/lib/entity-categories/tree";
import { cn } from "@/lib/utils";

type TreeNodeProps = {
  node: EntityCategoryTreeNode;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  onSelect: (id: string) => void;
  onBulkRowToggle: (id: string, checked: boolean) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
};

function EntityCategoryTreeNodeRow({
  node,
  selectedId,
  bulkSelectedIds,
  onSelect,
  onBulkRowToggle,
  expandedIds,
  onToggleExpand,
}: TreeNodeProps) {
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
            <EntityCategoryTreeNodeRow
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

type Props = {
  filteredTree: EntityCategoryTreeNode[];
  totalRows: number;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  onSelect: (id: string) => void;
  onBulkRowToggle: (id: string, checked: boolean) => void;
};

export function EntityCategoryTreePanel({
  filteredTree,
  totalRows,
  selectedId,
  bulkSelectedIds,
  onSelect,
  onBulkRowToggle,
}: Props) {
  const expandableIds = useMemo(
    () => collectExpandableEntityCategoryIds(filteredTree),
    [filteredTree]
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(expandableIds);

  useEffect(() => {
    setExpandedIds(expandableIds);
  }, [expandableIds]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto overscroll-contain scrollbar-none px-0.5 pt-2">
      <div className="min-h-0 flex-1 space-y-1 pb-2">
        {filteredTree.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {totalRows === 0 ? "No categories yet." : "No categories match your search."}
          </p>
        ) : (
          filteredTree.map((node) => (
            <EntityCategoryTreeNodeRow
              key={node.id}
              node={node}
              selectedId={selectedId}
              bulkSelectedIds={bulkSelectedIds}
              onSelect={onSelect}
              onBulkRowToggle={onBulkRowToggle}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
            />
          ))
        )}
      </div>
    </div>
  );
}
