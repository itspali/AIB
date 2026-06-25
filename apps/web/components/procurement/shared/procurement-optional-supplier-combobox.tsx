"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ImportLogisticsFieldLabel } from "@/components/procurement/import-logistics/import-logistics-field-label";
import { entityCreateHref } from "@/lib/entities/entity-navigation";
import { popoverAboveDrawerClassName } from "@/lib/layout/overlay-z-index";
import type { ProcurementSupplierOption } from "@/lib/procurement/shared/types";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  suppliers: ProcurementSupplierOption[];
  value: string | null;
  disabled?: boolean;
  label: string;
  help?: ReactNode;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  onChange: (supplierId: string | null) => void;
};

export function ProcurementOptionalSupplierCombobox({
  suppliers,
  value,
  disabled = false,
  label,
  help,
  placeholder = "Search suppliers…",
  allowEmpty = true,
  emptyLabel = "None",
  onChange,
}: Props) {
  const listboxId = useId();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selected = suppliers.find((row) => row.id === value) ?? null;

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.id, selected?.name]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return suppliers;
    return suppliers.filter((row) => row.name.toLowerCase().includes(normalized));
  }, [query, suppliers]);

  const selectSupplier = useCallback(
    (supplier: ProcurementSupplierOption | null) => {
      onChange(supplier?.id ?? null);
      setQuery(supplier?.name ?? "");
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
              setHighlightIndex((index) => Math.min(index + 1, Math.max(optionsCount - 1, 0)));
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              if (allowEmpty && highlightIndex === 0) {
                selectSupplier(null);
                return;
              }
              const rowIndex = allowEmpty ? highlightIndex - 1 : highlightIndex;
              const row = filtered[rowIndex];
              if (row) selectSupplier(row);
            }
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
                  className={cn(
                    "flex w-full rounded-sm px-2.5 py-2 text-left text-sm hover:bg-accent/70",
                    highlightIndex === 0 && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSupplier(null)}
                >
                  {emptyLabel}
                </button>
              </li>
            ) : null}
            {filtered.map((supplier, index) => {
              const optionIndex = allowEmpty ? index + 1 : index;
              return (
                <li key={supplier.id} role="presentation">
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col rounded-sm px-2.5 py-2 text-left text-sm hover:bg-accent/70",
                      optionIndex === highlightIndex && "bg-accent text-accent-foreground"
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSupplier(supplier)}
                  >
                    <span className="font-medium">{supplier.name}</span>
                  </button>
                </li>
              );
            })}
            <li role="presentation" className="mt-1 border-t border-border pt-1">
              <Link
                href={entityCreateHref("supplier")}
                className="flex items-center gap-1.5 rounded-sm px-2.5 py-2 text-sm font-medium text-primary hover:bg-accent/70"
                onMouseDown={(event) => event.preventDefault()}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create supplier…
              </Link>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}
