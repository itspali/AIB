"use client";

import { ChevronRight, Globe2, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  locationCapabilitySummary,
  posCountCompactLabel,
  resolveLocationTagVariant,
  tagLabel,
} from "@/lib/locations/axis-labels";
import type { LocationTreeNode } from "@/lib/locations/types";
import { cn } from "@/lib/utils";

type Props = {
  node: LocationTreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
};

export function LocationTopologyNodeRow({
  node,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
}: Props) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const tagVariant = resolveLocationTagVariant(node);

  return (
    <div className="group/node">
      <div
        className={cn(
          "relative flex items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-200",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent"
        )}
        style={{ paddingLeft: `${node.depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            className="shrink-0 rounded p-0.5 hover:bg-muted"
            aria-label={isExpanded ? "Collapse node" : "Expand node"}
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
          {node.presence_type === "VIRTUAL" && node.is_commercial_storefront ? (
            <Link2 className="h-4 w-4 shrink-0 text-indigo-500" />
          ) : node.parent_location_id === null ? (
            <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : null}
          <span className="truncate font-medium">{node.name}</span>
        </button>

        <Badge
          variant={tagVariant}
          className={cn(tagVariant === "active" && "ring-2 ring-indigo-500/40")}
        >
          {tagLabel(tagVariant)}
        </Badge>

        <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-64 -translate-y-1/2 rounded-lg border border-border bg-popover p-3 text-xs shadow-md group-hover/node:block">
          <p className="font-semibold">{node.name}</p>
          <p className="mt-1 text-muted-foreground">
            {node.code} · {locationCapabilitySummary(node)}
          </p>
          <p className="mt-2 text-muted-foreground">
            {node.city}, {node.state} {node.zip_postal}
          </p>
          <p className="mt-1 text-muted-foreground">
            {node.is_stock_holding ? "Stock holding" : "Non-stock"} · {node.child_count} children
            {node.pos_terminal_count > 0
              ? posCountCompactLabel(node.presence_type, node.pos_terminal_count)
              : ""}
          </p>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <LocationTopologyNodeRow
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}
