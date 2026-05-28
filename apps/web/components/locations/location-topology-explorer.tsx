"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LocationTopologyNodeRow } from "@/components/locations/location-topology-node";
import {
  buildLocationTopologyTree,
  collectDefaultExpandedIds,
  filterLocationTopologyTree,
} from "@/lib/locations/topology";
import type { LocationTopologyRow } from "@/lib/locations/types";

type Props = {
  rows: LocationTopologyRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function LocationTopologyExplorer({ rows, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    collectDefaultExpandedIds(rows)
  );

  const tree = useMemo(() => buildLocationTopologyTree(rows), [rows]);
  const filteredTree = useMemo(() => filterLocationTopologyTree(tree, query), [tree, query]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="surface-panel flex h-full min-h-[480px] flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Enterprise Topology Explorer
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Expand nodes to traverse Global HQ through regional zones. Hover for node metadata.
        </p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topology…"
          className="pl-9"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredTree.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {rows.length === 0
              ? "No topology nodes yet. Enable Regional HQs and create hierarchy locations in the Directory."
              : "No nodes match your search."}
          </p>
        ) : (
          filteredTree.map((node) => (
            <LocationTopologyNodeRow
              key={node.id}
              node={node}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
            />
          ))
        )}
      </div>
    </div>
  );
}
