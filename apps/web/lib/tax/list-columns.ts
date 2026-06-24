import {
  BOOLEAN_ACTIVE_INACTIVE_CATALOG,
  BOOLEAN_YES_NO_CATALOG,
} from "@/lib/list-columns/chip-colors";
import { columnWidths } from "@/lib/list-columns/sizing";
import {
  CHIP_DEFAULT_FALLBACK_KEY,
  type ListColumnDef,
  type ListColumnRegistry,
} from "@/lib/list-columns/types";
import { TAX_CODE_KINDS, taxCodeKindLabel, type TaxCodeKind } from "@/lib/tax/types";

export const TAX_LIST_COLUMN_IDS = [
  "code",
  "name",
  "kind",
  "rate",
  "is_active",
  "is_variable",
  "is_recoverable",
  "components",
  "effective_from",
  "effective_to",
  "updated_at",
] as const;

export type TaxListColumnId = (typeof TAX_LIST_COLUMN_IDS)[number];

export type TaxListColumnDef = ListColumnDef<TaxListColumnId>;

const W_CODE = columnWidths({
  default: { min: 88, max: 140 },
  desktop: { min: 96, max: 160 },
});

const W_NAME = columnWidths({
  default: { min: 140, max: 280 },
  mobile: { min: 120, max: 200 },
  desktop: { min: 160, max: 320 },
});

const W_KIND = columnWidths({
  default: { min: 96, max: 132 },
});

const W_RATE = columnWidths({
  default: { min: 72, max: 120 },
});

const W_STATUS = columnWidths({
  default: { min: 96, max: 112 },
});

const W_BOOLEAN = columnWidths({
  default: { min: 88, max: 132 },
});

const W_TEXT = columnWidths({
  default: { min: 120, max: 240 },
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

const TAX_KIND_CHIP_COLORS: Record<string, { preset: "sky" | "violet" | "amber" | "neutral" | "slate" }> = {
  GST: { preset: "sky" },
  VAT: { preset: "violet" },
  SALES_TAX: { preset: "amber" },
  EXEMPT: { preset: "neutral" },
  NIL: { preset: "slate" },
  ZERO: { preset: "slate" },
};

export const TAX_LIST_COLUMNS: TaxListColumnDef[] = [
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
    id: "kind",
    label: "Kind",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_KIND,
    chipEligible: true,
    chipValueCatalog: TAX_CODE_KINDS.map((kind) => ({
      value: kind,
      label: taxCodeKindLabel(kind),
    })),
    chipDefaultColors: {
      ...TAX_KIND_CHIP_COLORS,
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
  },
  {
    id: "rate",
    label: "Rate",
    defaultVisible: true,
    align: "right",
    group: "Rates",
    valueKind: "text",
    widths: W_RATE,
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
    id: "is_variable",
    label: "Variable",
    defaultVisible: false,
    align: "center",
    group: "Rates",
    widths: W_BOOLEAN,
    chipEligible: true,
    chipValueCatalog: BOOLEAN_YES_NO_CATALOG,
    chipDefaultColors: BOOLEAN_YES_NO_DEFAULTS,
  },
  {
    id: "is_recoverable",
    label: "Recoverable",
    defaultVisible: false,
    align: "center",
    group: "Status",
    widths: W_BOOLEAN,
    chipEligible: true,
    chipValueCatalog: BOOLEAN_YES_NO_CATALOG,
    chipDefaultColors: BOOLEAN_YES_NO_DEFAULTS,
  },
  {
    id: "components",
    label: "Components",
    defaultVisible: false,
    group: "Rates",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "effective_from",
    label: "Effective from",
    defaultVisible: false,
    group: "Validity",
    valueKind: "date",
    widths: W_DATE,
  },
  {
    id: "effective_to",
    label: "Effective to",
    defaultVisible: false,
    group: "Validity",
    valueKind: "date",
    widths: W_DATE,
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

export const TAX_LIST_COLUMN_REGISTRY: ListColumnRegistry<TaxListColumnId> = {
  ids: TAX_LIST_COLUMN_IDS,
  columns: TAX_LIST_COLUMNS,
  storageKey: "aib-tax-list-columns",
};

export function getTaxColumnDef(id: TaxListColumnId): TaxListColumnDef {
  return TAX_LIST_COLUMNS.find((column) => column.id === id)!;
}

export function isTaxKindFilter(value: string): value is TaxCodeKind | "all" {
  return value === "all" || (TAX_CODE_KINDS as readonly string[]).includes(value);
}
