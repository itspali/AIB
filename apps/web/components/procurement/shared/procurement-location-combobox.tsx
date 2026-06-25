"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ImportLogisticsFieldLabel } from "@/components/procurement/import-logistics/import-logistics-field-label";
import { popoverAboveDrawerClassName } from "@/lib/layout/overlay-z-index";
import { moduleDrawerCreateHref } from "@/lib/layout/module-drawer-url";
import { SETTINGS_LOCATIONS_HREF } from "@/lib/procurement/navigation";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  locations: ProcurementLocationOption[];
  value: string | null;
  disabled?: boolean;
  label: string;
  help?: ReactNode;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  onChange: (locationId: string | null) => void;
};

export function ProcurementLocationCombobox({
  locations,
  value,
  disabled = false,
  label,
  help,
  placeholder = "Search locations…",
  allowEmpty = false,
  emptyLabel = "Not set",
  onChange,
}: Props) {
  const listboxId = useId();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selected = locations.find((row) => row.id === value) ?? null;

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.id, selected?.name]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return locations;
    return locations.filter(
      (row) =>
        row.name.toLowerCase().includes(normalized) ||
        row.code?.toLowerCase().includes(normalized)
    );
  }, [locations, query]);

  const selectLocation = useCallback(
    (location: ProcurementLocationOption | null) => {
      onChange(location?.id ?? null);
      setQuery(location?.name ?? "");
      setOpen(false);
    },
    [onChange]
  );

  const optionsCount = filtered.length + (allowEmpty ? 1 : 0);

  return (
    <div className="min-w-0 w-full space-y-2">
      <ImportLogisticsFieldLabel label={label} help={help} />
      <div ref={anchorRef} className="relative min-w-0 w-full">
        <Input
          value={query}
          disabled={disabled}
          className="w-full min-w-0"
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlightIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setHighlightIndex((index) => Math.min(index + 1, Math.max(optionsCount - 1, 0)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightIndex((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              if (allowEmpty && highlightIndex === 0) {
                selectLocation(null);
                return;
              }
              const rowIndex = allowEmpty ? highlightIndex - 1 : highlightIndex;
              const row = filtered[rowIndex];
              if (row) selectLocation(row);
            }
            if (event.key === "Escape") setOpen(false);
          }}
        />
        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            className={cn(
              "absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md",
              popoverAboveDrawerClassName
            )}
          >
            {allowEmpty ? (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value == null}
                  className={cn(
                    "flex w-full rounded-sm px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/70",
                    highlightIndex === 0 && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectLocation(null)}
                >
                  {emptyLabel}
                </button>
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-sm text-muted-foreground">No locations match.</li>
            ) : (
              filtered.map((location, index) => {
                const optionIndex = allowEmpty ? index + 1 : index;
                return (
                  <li key={location.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={location.id === value}
                      className={cn(
                        "flex w-full flex-col rounded-sm px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/70",
                        optionIndex === highlightIndex && "bg-accent text-accent-foreground"
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectLocation(location)}
                    >
                      <span className="font-medium">{location.name}</span>
                      {location.code ? (
                        <span className="text-xs text-muted-foreground">{location.code}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
            <li role="presentation" className="mt-1 border-t border-border pt-1">
              <Link
                href={moduleDrawerCreateHref(SETTINGS_LOCATIONS_HREF)}
                className="flex items-center gap-1.5 rounded-sm px-2.5 py-2 text-sm font-medium text-primary hover:bg-accent/70"
                onMouseDown={(event) => event.preventDefault()}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create location…
              </Link>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}
