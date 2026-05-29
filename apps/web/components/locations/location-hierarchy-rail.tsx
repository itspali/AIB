"use client";

import { useEffect, useMemo, useState } from "react";
import { LocationHierarchyNodeRow } from "@/components/locations/location-hierarchy-node";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { buildLocationTreeFromRows, filterLocationTopologyTree } from "@/lib/locations/topology";
import type { LocationRow } from "@/lib/locations/types";
import { filterLocationsByAst } from "@/lib/search/executor/client-scopes";

type Props = {
  rows: LocationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  centralHqLocationId: string | null;
};

export function LocationHierarchyRail({
  rows,
  selectedId,
  onSelect,
  centralHqLocationId,
}: Props) {
  const omnibar = useOptionalOmnibarContext();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const tree = useMemo(() => buildLocationTreeFromRows(rows), [rows]);

  const filteredTree = useMemo(() => {
    const query = omnibar?.appliedQuery?.trim() ?? "";
    if (!query) return tree;

    if (omnibar?.scope === "locations" && omnibar.activeAst.length) {
      const filteredRows = filterLocationsByAst(rows, omnibar.activeAst);
      const filteredIds = new Set(filteredRows.map((row) => row.id));
      return filterLocationTopologyTree(tree, "").filter((node) => filteredIds.has(node.id));
    }

    return filterLocationTopologyTree(tree, query);
  }, [tree, rows, omnibar?.scope, omnibar?.appliedQuery, omnibar?.activeAst]);

  useEffect(() => {
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set(tree.map((node) => node.id));
    });
  }, [tree]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reporting Directory
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Recursive facility tree ordered by parent_location_id hierarchy. Filter via header omnibar.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {filteredTree.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {rows.length === 0 ? "No locations yet." : "No locations match your search."}
          </p>
        ) : (
          filteredTree.map((node) => (
            <LocationHierarchyNodeRow
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              centralHqLocationId={centralHqLocationId}
            />
          ))
        )}
      </div>
    </div>
  );
}
