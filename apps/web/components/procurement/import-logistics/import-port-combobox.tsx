"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ImportLogisticsFieldLabel } from "@/components/procurement/import-logistics/import-logistics-field-label";
import {
  formatImportPortLabel,
  findImportPortByCode,
  IMPORT_PORT_OPTIONS,
} from "@/lib/procurement/import-logistics/port-options";
import { popoverAboveDrawerClassName } from "@/lib/layout/overlay-z-index";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  value: string;
  disabled?: boolean;
  label: string;
  help?: ReactNode;
  placeholder?: string;
  onChange: (code: string) => void;
};

export function ImportPortCombobox({
  value,
  disabled = false,
  label,
  help,
  placeholder = "Search ports…",
  onChange,
}: Props) {
  const listboxId = useId();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [useCustom, setUseCustom] = useState(false);

  const known = useMemo(() => findImportPortByCode(value), [value]);

  useEffect(() => {
    if (known) {
      setQuery(formatImportPortLabel(known));
      setUseCustom(false);
      return;
    }
    if (value.trim()) {
      setQuery(value);
      setUseCustom(true);
      return;
    }
    setQuery("");
    setUseCustom(false);
  }, [known, value]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return IMPORT_PORT_OPTIONS;
    return IMPORT_PORT_OPTIONS.filter(
      (port) =>
        port.code.toLowerCase().includes(normalized) ||
        port.name.toLowerCase().includes(normalized) ||
        port.country.toLowerCase().includes(normalized)
    );
  }, [query]);

  const selectPort = useCallback(
    (code: string, display: string, custom: boolean) => {
      onChange(code);
      setQuery(display);
      setUseCustom(custom);
      setOpen(false);
    },
    [onChange]
  );

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
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            setHighlightIndex(0);
            if (useCustom) onChange(next.toUpperCase());
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setHighlightIndex((index) =>
                Math.min(index + 1, Math.max(filtered.length, 0))
              );
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              if (highlightIndex === filtered.length) {
                selectPort(query.trim().toUpperCase(), query, true);
                return;
              }
              const port = filtered[highlightIndex];
              if (port) selectPort(port.code, formatImportPortLabel(port), false);
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
            {filtered.map((port, index) => (
              <li key={port.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  className={cn(
                    "flex w-full flex-col rounded-sm px-2.5 py-2 text-left text-sm hover:bg-accent/70",
                    index === highlightIndex && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectPort(port.code, formatImportPortLabel(port), false)}
                >
                  <span className="font-medium">{port.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {port.code} · {port.country}
                  </span>
                </button>
              </li>
            ))}
            <li role="presentation" className="mt-1 border-t border-border pt-1">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 rounded-sm px-2.5 py-2 text-sm font-medium text-primary hover:bg-accent/70"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectPort(query.trim().toUpperCase(), query, true)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Use custom code: {query.trim() || "…"}
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}
