import { BOOLEAN_ACTIVE_INACTIVE_CATALOG, BOOLEAN_YES_NO_CATALOG } from "@/lib/list-columns/chip-colors";
import { columnWidths } from "@/lib/list-columns/sizing";
import {
  CHIP_DEFAULT_FALLBACK_KEY,
  type ListColumnDef,
  type ListColumnRegistry,
} from "@/lib/list-columns/types";
import { UOM_FAMILIES, uomFamilyLabel, type UomFamily } from "@/lib/uom/types";

export const UOM_LIST_COLUMN_IDS = [
  "code",
  "name",
  "family",
  "factor_to_base",
  "is_family_base",
  "is_active",
  "updated_at",
] as const;

export type UomListColumnId = (typeof UOM_LIST_COLUMN_IDS)[number];

export type UomListColumnDef = ListColumnDef<UomListColumnId>;

const W_CODE = columnWidths({
  default: { min: 72, max: 120 },
  desktop: { min: 80, max: 140 },
});

const W_NAME = columnWidths({
  default: { min: 120, max: 240 },
  mobile: { min: 100, max: 180 },
  desktop: { min: 140, max: 280 },
});

const W_FAMILY = columnWidths({
  default: { min: 88, max: 132 },
});

const W_FACTOR = columnWidths({
  default: { min: 88, max: 120 },
});

const W_BOOLEAN = columnWidths({
  default: { min: 72, max: 100 },
});

const W_STATUS = columnWidths({
  default: { min: 96, max: 112 },
});

const W_DATE = columnWidths({
  default: { min: 100, max: 140 },
});

const ACTIVE_INACTIVE_DEFAULTS = {
  true: { preset: "emerald" as const },
  false: { preset: "red" as const },
  [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" as const },
};

const BOOLEAN_YES_NO_DEFAULTS = {
  true: { preset: "emerald" as const },
  false: { preset: "slate" as const },
  [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" as const },
};

const FAMILY_CHIP_COLORS: Record<string, { preset: "sky" | "violet" | "amber" | "emerald" | "rose" | "neutral" }> = {
  COUNT: { preset: "sky" },
  WEIGHT: { preset: "violet" },
  LENGTH: { preset: "amber" },
  AREA: { preset: "emerald" },
  VOLUME: { preset: "rose" },
  TIME: { preset: "neutral" },
};

export const UOM_LIST_COLUMNS: UomListColumnDef[] = [
  {
    id: "code",
    label: "Code",
    defaultVisible: true,
    group: "Identity",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "name",
    label: "Name",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_NAME,
  },
  {
    id: "family",
    label: "Family",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_FAMILY,
    chipEligible: true,
    chipValueCatalog: UOM_FAMILIES.map((family) => ({
      value: family,
      label: uomFamilyLabel(family),
    })),
    chipDefaultColors: {
      ...FAMILY_CHIP_COLORS,
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
  },
  {
    id: "factor_to_base",
    label: "Factor to base",
    defaultVisible: true,
    align: "right",
    group: "Conversion",
    valueKind: "text",
    widths: W_FACTOR,
  },
  {
    id: "is_family_base",
    label: "Base",
    defaultVisible: true,
    align: "center",
    group: "Conversion",
    widths: W_BOOLEAN,
    chipEligible: true,
    chipValueCatalog: BOOLEAN_YES_NO_CATALOG,
    chipDefaultColors: BOOLEAN_YES_NO_DEFAULTS,
  },
  {
    id: "is_active",
    label: "Status",
    defaultVisible: true,
    align: "center",
    group: "Status",
    widths: W_STATUS,
    chipEligible: true,
    chipValueCatalog: BOOLEAN_ACTIVE_INACTIVE_CATALOG,
    chipDefaultColors: ACTIVE_INACTIVE_DEFAULTS,
  },
  {
    id: "updated_at",
    label: "Updated",
    defaultVisible: false,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
];

export const UOM_LIST_COLUMN_REGISTRY: ListColumnRegistry<UomListColumnId> = {
  ids: UOM_LIST_COLUMN_IDS,
  columns: UOM_LIST_COLUMNS,
  storageKey: "aib-uom-list-columns",
};

export function getUomColumnDef(id: UomListColumnId): UomListColumnDef {
  return UOM_LIST_COLUMNS.find((column) => column.id === id)!;
}

export function isUomFamilyFilter(value: string): value is UomFamily | "all" {
  return value === "all" || (UOM_FAMILIES as readonly string[]).includes(value);
}
