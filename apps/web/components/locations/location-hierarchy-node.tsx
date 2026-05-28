"use client";

import { Building2, ChevronRight, Globe2 } from "lucide-react";
import { resolveAxisMicroBadges } from "@/lib/locations/axis-labels";
import type { LocationTreeNode } from "@/lib/locations/types";
import { cn } from "@/lib/utils";

type Props = {
  node: LocationTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  centralHqLocationId: string | null;
};

export function LocationHierarchyNodeRow({
  node,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
  centralHqLocationId,
}: Props) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const badges = resolveAxisMicroBadges(node);
  const PresenceIcon = node.presence_type === "VIRTUAL" ? Globe2 : Building2;

  return (
    <div>
      <div
        className={cn(
          "group/node flex items-start gap-1.5 rounded-lg px-2 py-2 transition-colors duration-200",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            className="mt-0.5 shrink-0 rounded p-0.5 transition-colors duration-200 hover:bg-muted"
            aria-label={isExpanded ? "Collapse branch" : "Expand branch"}
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
          className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <PresenceIcon
              className={cn(
                "h-4 w-4 shrink-0",
                node.presence_type === "VIRTUAL" ? "text-indigo-500" : "text-muted-foreground"
              )}
            />
            <span className="truncate text-sm font-medium">{node.name}</span>
            {centralHqLocationId === node.id && (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/30 dark:text-indigo-300">
                HQ
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 pl-6">
            <span className="text-[11px] text-muted-foreground">{node.code}</span>
            {badges.map((badge) => (
              <span
                key={badge.key}
                className={cn(
                  "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  badge.className
                )}
              >
                {badge.label}
              </span>
            ))}
            {!node.is_active && (
              <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground ring-1 ring-border">
                Inactive
              </span>
            )}
          </div>
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <LocationHierarchyNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              centralHqLocationId={centralHqLocationId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
