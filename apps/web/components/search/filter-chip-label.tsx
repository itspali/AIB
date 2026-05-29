"use client";

import { clauseToLabelParts } from "@/lib/search/compiler/clause-label";
import type { AstClause } from "@/lib/search/types";
import { cn } from "@/lib/utils";

type Props = {
  clause: AstClause;
  className?: string;
};

export function FilterChipLabel({ clause, className }: Props) {
  const parts = clauseToLabelParts(clause);

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1", className)}>
      {parts.map((part, index) => (
        <span
          key={`${part.kind}-${part.text}-${index}`}
          className={cn(
            part.kind === "field" &&
              "font-semibold uppercase tracking-wide text-primary",
            part.kind === "operator" && "font-medium text-amber-600 dark:text-amber-400",
            part.kind === "value" && "text-primary/90"
          )}
        >
          {part.text}
        </span>
      ))}
    </span>
  );
}
