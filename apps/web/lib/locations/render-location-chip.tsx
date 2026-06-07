import type { ReactNode } from "react";
import { booleanValueKey } from "@/lib/list-columns/chip-colors";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  getLocationColumnDef,
  type LocationListColumnId,
} from "@/lib/locations/list-columns";
import type { LocationRow } from "@/lib/locations/types";
import { presenceLabel } from "@/lib/locations/axis-labels";

type ChipDisplayMap = Partial<Record<LocationListColumnId, ColumnChipDisplay>>;

export function renderLocationActiveStatus(
  isActive: boolean,
  chipDisplay?: ChipDisplayMap,
  textClassName?: string
): ReactNode {
  const column = getLocationColumnDef("is_active");
  const label = isActive ? "ACTIVE" : "INACTIVE";
  const defaultClassName = isActive
    ? "text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
    : "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";
  return renderChipOrText({
    column,
    valueKey: booleanValueKey(isActive),
    label,
    textNode: <span className={textClassName ?? defaultClassName}>{label}</span>,
    chipDisplay: chipDisplay?.is_active,
  });
}

export function renderLocationPresenceChip(
  row: Pick<LocationRow, "presence_type">,
  chipDisplay?: ChipDisplayMap
): ReactNode {
  const column = getLocationColumnDef("presence_type");
  const label = presenceLabel(row.presence_type);
  return renderChipOrText({
    column,
    valueKey: row.presence_type,
    label,
    textNode: <span className="text-[11px] text-muted-foreground">{label}</span>,
    chipDisplay: chipDisplay?.presence_type,
  });
}

export function renderLocationCentralHqChip(
  isCentralHq: boolean,
  chipDisplay?: ChipDisplayMap
): ReactNode {
  if (!isCentralHq) return null;
  const column = getLocationColumnDef("central_hq");
  return renderChipOrText({
    column,
    valueKey: booleanValueKey(isCentralHq),
    label: "HQ",
    textNode: (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/30 dark:text-indigo-300">
        HQ
      </span>
    ),
    chipDisplay: chipDisplay?.central_hq,
  });
}
