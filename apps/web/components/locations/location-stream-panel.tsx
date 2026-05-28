"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { locationCapabilitySummary } from "@/lib/locations/axis-labels";
import type { LocationRow } from "@/lib/locations/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: LocationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  centralHqLocationId: string | null;
};

export function LocationStreamPanel({
  rows,
  selectedId,
  onSelect,
  centralHqLocationId,
}: Props) {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(normalized) ||
        row.code.toLowerCase().includes(normalized) ||
        row.city.toLowerCase().includes(normalized)
    );
  }, [query, rows]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search locations…"
          className="pl-9"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-1">
        {filteredRows.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {rows.length === 0 ? "No locations yet." : "No locations match your search."}
          </p>
        ) : (
          filteredRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200",
                selectedId === row.id ? "bg-primary/10 text-primary" : "hover:bg-accent"
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{row.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.code} · {locationCapabilitySummary(row)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {centralHqLocationId === row.id && (
                  <Badge variant="active">CENTRAL HQ</Badge>
                )}
                <Badge variant={row.is_active ? "completed" : "locked"}>
                  {row.is_active ? "ACTIVE" : "INACTIVE"}
                </Badge>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
