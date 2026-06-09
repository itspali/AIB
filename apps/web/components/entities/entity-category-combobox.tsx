"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entityCategoryNewHref } from "@/lib/entity-categories/navigation";
import { entityCategoryParentSelectOptions } from "@/lib/entity-categories/tree";
import type { EntityCategoryRow } from "@/lib/entity-categories/types";
import type { EntityWorkspace } from "@/lib/entities/types";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import { popoverAboveDrawerClassName } from "@/lib/layout/overlay-z-index";
import { cn } from "@/lib/utils";

type CategoryOption = {
  id: string;
  label: string;
  depth: number;
};

type Props = {
  workspace: EntityWorkspace;
  categoryRows: EntityCategoryRow[];
  value: string;
  disabled?: boolean;
  className?: string;
  onChange: (categoryId: string) => void;
};

function buildCategoryOptions(rows: EntityCategoryRow[]): CategoryOption[] {
  const activeRows = rows.filter((row) => row.is_active);
  return entityCategoryParentSelectOptions(activeRows)
    .filter((option): option is { id: string; label: string; depth: number } => option.id !== null)
    .map((option) => ({
      id: option.id,
      label: option.label,
      depth: option.depth,
    }));
}

export function EntityCategoryCombobox({
  workspace,
  categoryRows,
  value,
  disabled = false,
  className,
  onChange,
}: Props) {
  const config = getEntityWorkspaceConfig(workspace);
  const listboxId = useId();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const options = useMemo(() => buildCategoryOptions(categoryRows), [categoryRows]);
  const selected = options.find((row) => row.id === value) ?? null;

  useEffect(() => {
    setQuery(selected?.label ?? "");
  }, [selected?.id, selected?.label]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((row) => row.label.toLowerCase().includes(normalized));
  }, [options, query]);

  const selectCategory = useCallback(
    (category: CategoryOption) => {
      onChange(category.id);
      setQuery(category.label);
      setOpen(false);
    },
    [onChange]
  );

  const fieldLabel =
    workspace === "customer" ? "Customer category" : "Supplier category";

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <Label htmlFor={`entity-category-${workspace}`}>{fieldLabel}</Label>
      <div ref={anchorRef} className="relative min-w-0">
        <Input
          id={`entity-category-${workspace}`}
          value={query}
          disabled={disabled}
          className="min-w-0"
          placeholder={`Search ${config.singularLabel.toLowerCase()} categories…`}
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
              setHighlightIndex((current) =>
                Math.min(current + 1, Math.max(filtered.length - 1, 0))
              );
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightIndex((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Enter" && open && filtered[highlightIndex]) {
              event.preventDefault();
              selectCategory(filtered[highlightIndex]!);
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
              <li className="px-2.5 py-2 text-sm text-muted-foreground">No categories match.</li>
            ) : (
              filtered.map((category, index) => (
                <li key={category.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={category.id === value}
                    className={cn(
                      "flex w-full rounded-sm px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/70",
                      index === highlightIndex && "bg-accent text-accent-foreground"
                    )}
                    style={{ paddingLeft: `${category.depth * 12 + 10}px` }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCategory(category)}
                  >
                    <span className="truncate font-medium">{category.label}</span>
                  </button>
                </li>
              ))
            )}
            <li role="presentation" className="mt-1 border-t border-border pt-1">
              <Link
                href={entityCategoryNewHref(workspace)}
                className="flex items-center gap-1.5 rounded-sm px-2.5 py-2 text-sm font-medium text-primary hover:bg-accent/70"
                onMouseDown={(event) => event.preventDefault()}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create category…
              </Link>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}
