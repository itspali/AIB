import type { ReactNode } from "react";
import { FieldValueChip } from "@/components/list-columns/field-value-chip";
import {
  getEffectiveChipDisplay,
  resolveValueColorRule,
} from "@/lib/list-columns/chip-colors";
import type { ColumnChipDisplay, ListColumnDef } from "@/lib/list-columns/types";

export function renderChipOrText<TId extends string>({
  column,
  valueKey,
  label,
  textNode,
  chipDisplay,
}: {
  column: ListColumnDef<TId>;
  valueKey: string;
  label: string;
  textNode: ReactNode;
  chipDisplay?: ColumnChipDisplay;
}): ReactNode {
  const effective = getEffectiveChipDisplay(column, chipDisplay);
  if (effective.mode !== "chip") return textNode;

  return (
    <FieldValueChip
      label={label}
      colorRule={resolveValueColorRule(valueKey, effective)}
    />
  );
}
