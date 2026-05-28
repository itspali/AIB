"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LocationHierarchyNodeRow } from "@/components/locations/location-hierarchy-node";
import { buildLocationTreeFromRows, filterLocationTopologyTree } from "@/lib/locations/topology";
import type { LocationRow } from "@/lib/locations/types";

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
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const tree = useMemo(() => buildLocationTreeFromRows(rows), [rows]);
  const filteredTree = useMemo(() => filterLocationTopologyTree(tree, query), [tree, query]);

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
          Recursive facility tree ordered by parent_location_id hierarchy.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter facilities in real time…"
          className="pl-9"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
        {filteredTree.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {rows.length === 0
              ? "No facility nodes provisioned yet."
              : "No facilities match your search filter."}
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
