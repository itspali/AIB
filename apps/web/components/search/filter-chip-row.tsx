"use client";

import { X } from "lucide-react";
import { FilterChipLabel } from "@/components/search/filter-chip-label";
import { clauseToLabel } from "@/lib/search/compiler/clause-label";
import type { AstClause } from "@/lib/search/types";
import { cn } from "@/lib/utils";

type Props = {
  ast: AstClause[];
  className?: string;
  onRemove?: (index: number) => void;
};

export function FilterChipRow({ ast, className, onRemove }: Props) {
  const chips = ast.filter((clause) => clause.kind !== "text");

  if (!chips.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((clause, index) => (
        <span
          key={`${clause.kind}-${clauseToLabel(clause)}-${index}`}
          className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-0.5 pl-2 pr-1 text-[11px] text-primary"
        >
          <FilterChipLabel clause={clause} />
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="rounded-full p-0.5 text-primary/70 transition-colors duration-200 hover:bg-primary/10 hover:text-primary"
              aria-label={`Remove filter ${clauseToLabel(clause)}`}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}
