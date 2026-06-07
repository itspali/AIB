"use client";

import type { ColumnValueColorRule } from "@/lib/list-columns/types";
import { resolveChipColorRule } from "@/lib/list-columns/chip-colors";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  colorRule?: ColumnValueColorRule;
  className?: string;
};

export function FieldValueChip({ label, colorRule, className }: Props) {
  const resolved = resolveChipColorRule(colorRule);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0",
        resolved.className,
        className
      )}
      style={resolved.style}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
