"use client";

import { clauseToLabel } from "@/lib/search/compiler/compile";
import type { AstClause } from "@/lib/search/types";
import { cn } from "@/lib/utils";

type Props = {
  ast: AstClause[];
  className?: string;
};

export function FilterChipRow({ ast, className }: Props) {
  const chips = ast.filter((clause) => clause.kind !== "text");

  if (!chips.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((clause, index) => (
        <span
          key={`${clause.kind}-${index}`}
          className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
        >
          {clauseToLabel(clause)}
        </span>
      ))}
    </div>
  );
}
