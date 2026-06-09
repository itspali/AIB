"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DocumentLayoutLabel } from "@/components/documents/document-layout-label";
import type { DocumentColumnPref } from "@/lib/documents/types";
import { entityCreateHref } from "@/lib/entities/entity-navigation";
import { popoverAboveDrawerClassName } from "@/lib/layout/overlay-z-index";
import type { ProcurementSupplierOption } from "@/lib/procurement/shared/types";
import { cn } from "@/lib/utils";

type Props = {
  suppliers: ProcurementSupplierOption[];
  value: string;
  disabled?: boolean;
  className?: string;
  labelField?: Pick<DocumentColumnPref, "label" | "typography">;
  onChange: (supplierId: string) => void;
};

export function PoSupplierCombobox({
  suppliers,
  value,
  disabled = false,
  className,
  labelField,
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
    (supplier: ProcurementSupplierOption) => {
      onChange(supplier.id);
      setQuery(supplier.name);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <DocumentLayoutLabel field={labelField} fallbackLabel="Supplier" />
      <div ref={anchorRef} className="relative min-w-0">
        <Input
          value={query}
          disabled={disabled}
          className="min-w-0"
          placeholder="Search suppliers…"
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
              setHighlightIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightIndex((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Enter" && open && filtered[highlightIndex]) {
              event.preventDefault();
              selectSupplier(filtered[highlightIndex]!);
            }
            if (event.key === "Escape") {
              setOpen(false);
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
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-sm text-muted-foreground">
                No categorized suppliers match. Assign a supplier category before using a vendor on
                purchase orders.
              </li>
            ) : (
              filtered.map((supplier, index) => (
                <li key={supplier.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={supplier.id === value}
                    className={cn(
                      "flex w-full flex-col rounded-sm px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/70",
                      index === highlightIndex && "bg-accent text-accent-foreground"
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSupplier(supplier)}
                  >
                    <span className="font-medium">{supplier.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Net {supplier.payment_terms_days} days
                    </span>
                  </button>
                </li>
              ))
            )}
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
