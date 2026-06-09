import {
  BOOLEAN_ACTIVE_INACTIVE_CATALOG,
} from "@/lib/list-columns/chip-colors";
import { columnWidths } from "@/lib/list-columns/sizing";
import type { ListColumnDef, ListColumnRegistry } from "@/lib/list-columns/types";
import { CHIP_DEFAULT_FALLBACK_KEY } from "@/lib/list-columns/types";
import { ENTITY_TYPE_LABELS, PARTY_NATURE_LABELS, TAX_TREATMENT_LABELS } from "@/lib/entities/labels";
import {
  ENTITY_COMMERCIAL_TYPES,
  PARTY_NATURE_TYPES,
  TAX_TREATMENT_TYPES,
  type EntityCommercialType,
} from "@/lib/entities/types";

export const ENTITY_LIST_COLUMN_IDS = [
  "name",
  "code",
  "type",
  "party_nature",
  "customer_category",
  "supplier_category",
  "legal_name",
  "tax_treatment",
  "tax_registration_number",
  "primary_contact_name",
  "primary_contact_email",
  "company_email",
  "company_phone",
  "credit_limit",
  "current_balance",
  "payment_terms_days",
  "is_active",
  "created_at",
  "updated_at",
] as const;

export type EntityListColumnId = (typeof ENTITY_LIST_COLUMN_IDS)[number];

export type EntityListColumnDef = ListColumnDef<EntityListColumnId>;

const W_NAME = columnWidths({
  default: { min: 140, max: 280 },
  mobile: { min: 120, max: 200 },
  desktop: { min: 160, max: 320 },
});

const W_TEXT = columnWidths({
  default: { min: 120, max: 220 },
  mobile: { min: 100, max: 180 },
  desktop: { min: 120, max: 260 },
});

const W_STATUS = columnWidths({
  default: { min: 96, max: 112 },
});

const W_NUMBER = columnWidths({
  default: { min: 72, max: 108 },
  desktop: { min: 80, max: 120 },
});

const W_DATE = columnWidths({
  default: { min: 100, max: 140 },
});

const ACTIVE_INACTIVE_DEFAULTS = {
  true: { preset: "emerald" as const },
  false: { preset: "red" as const },
  [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" as const },
};

const ENTITY_TYPE_CHIP_CATALOG = ENTITY_COMMERCIAL_TYPES.map((value) => ({
  value,
  label: ENTITY_TYPE_LABELS[value],
}));

const TAX_TREATMENT_CHIP_CATALOG = TAX_TREATMENT_TYPES.map((value) => ({
  value,
  label: TAX_TREATMENT_LABELS[value].label,
}));

const ENTITY_TYPE_CHIP_DEFAULTS: Record<string, { preset: "sky" | "amber" | "violet" | "neutral" }> =
  {
    CUSTOMER: { preset: "sky" },
    SUPPLIER: { preset: "amber" },
    MUTUAL_PARTNER: { preset: "violet" },
    [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
  };

const PARTY_NATURE_CHIP_CATALOG = PARTY_NATURE_TYPES.map((value) => ({
  value,
  label: PARTY_NATURE_LABELS[value],
}));

const PARTY_NATURE_CHIP_DEFAULTS: Record<string, { preset: "sky" | "violet" | "neutral" }> = {
  INDIVIDUAL: { preset: "sky" },
  ORGANIZATION: { preset: "violet" },
  [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
};

const TAX_TREATMENT_CHIP_DEFAULTS: Record<
  string,
  { preset: "emerald" | "slate" | "amber" | "indigo" | "sky" | "violet" | "neutral" }
> = {
  REGULAR_B2B: { preset: "emerald" },
  UNREGISTERED_B2C: { preset: "slate" },
  COMPOSITION: { preset: "amber" },
  SEZ_DEVELOPER: { preset: "indigo" },
  OVERSEAS_EXPORT: { preset: "sky" },
  DEEMED_EXPORT: { preset: "violet" },
  [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
};

export const ENTITY_LIST_COLUMNS: EntityListColumnDef[] = [
  {
    id: "name",
    label: "Name",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_NAME,
  },
  {
    id: "code",
    label: "Code",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "type",
    label: "Type",
    defaultVisible: false,
    group: "Identity",
    valueKind: "text",
    widths: W_TEXT,
    chipEligible: true,
    chipValueCatalog: ENTITY_TYPE_CHIP_CATALOG,
    chipDefaultColors: ENTITY_TYPE_CHIP_DEFAULTS,
  },
  {
    id: "party_nature",
    label: "Party nature",
    defaultVisible: false,
    group: "Identity",
    valueKind: "text",
    widths: W_TEXT,
    chipEligible: true,
    chipValueCatalog: PARTY_NATURE_CHIP_CATALOG,
    chipDefaultColors: PARTY_NATURE_CHIP_DEFAULTS,
  },
  {
    id: "customer_category",
    label: "Customer category",
    defaultVisible: false,
    group: "Identity",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "supplier_category",
    label: "Supplier category",
    defaultVisible: false,
    group: "Identity",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "legal_name",
    label: "Legal name",
    defaultVisible: false,
    group: "Identity",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "tax_treatment",
    label: "Tax treatment",
    defaultVisible: false,
    group: "Tax",
    valueKind: "text",
    widths: W_TEXT,
    chipEligible: true,
    chipValueCatalog: TAX_TREATMENT_CHIP_CATALOG,
    chipDefaultColors: TAX_TREATMENT_CHIP_DEFAULTS,
  },
  {
    id: "tax_registration_number",
    label: "Tax ID",
    defaultVisible: false,
    group: "Tax",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "primary_contact_name",
    label: "Primary contact",
    defaultVisible: true,
    group: "Contacts",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "primary_contact_email",
    label: "Contact email",
    defaultVisible: false,
    group: "Contacts",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "company_email",
    label: "Company email",
    defaultVisible: false,
    group: "Contacts",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "company_phone",
    label: "Company phone",
    defaultVisible: false,
    group: "Contacts",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "credit_limit",
    label: "Credit limit",
    defaultVisible: true,
    align: "right",
    group: "Commercial",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "current_balance",
    label: "Balance",
    defaultVisible: true,
    align: "right",
    group: "Commercial",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "payment_terms_days",
    label: "Payment terms",
    defaultVisible: true,
    align: "right",
    group: "Commercial",
    valueKind: "number",
    widths: W_NUMBER,
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
    id: "created_at",
    label: "Created",
    defaultVisible: false,
    group: "Timestamps",
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

export const CUSTOMER_LIST_COLUMN_IDS = [
  "name",
  "code",
  "party_nature",
  "customer_category",
  "primary_contact_name",
  "credit_limit",
  "current_balance",
  "payment_terms_days",
  "is_active",
  "updated_at",
] as const satisfies readonly EntityListColumnId[];

export const SUPPLIER_LIST_COLUMN_IDS = [
  "name",
  "code",
  "party_nature",
  "supplier_category",
  "primary_contact_name",
  "primary_contact_email",
  "company_email",
  "payment_terms_days",
  "is_active",
  "updated_at",
] as const satisfies readonly EntityListColumnId[];

export type CustomerListColumnId = (typeof CUSTOMER_LIST_COLUMN_IDS)[number];
export type SupplierListColumnId = (typeof SUPPLIER_LIST_COLUMN_IDS)[number];

function buildRegistry(
  storageKey: string,
  visibleColumnIds: readonly EntityListColumnId[]
): ListColumnRegistry<EntityListColumnId> {
  const visibleSet = new Set<EntityListColumnId>(visibleColumnIds);
  return {
    ids: ENTITY_LIST_COLUMN_IDS,
    columns: ENTITY_LIST_COLUMNS.map((column) => ({
      ...column,
      defaultVisible: visibleSet.has(column.id),
    })),
    storageKey,
  };
}

export const CUSTOMER_LIST_COLUMN_REGISTRY = buildRegistry(
  "aib-entity-customer-list-prefs",
  CUSTOMER_LIST_COLUMN_IDS
);

export const SUPPLIER_LIST_COLUMN_REGISTRY = buildRegistry(
  "aib-entity-supplier-list-prefs",
  SUPPLIER_LIST_COLUMN_IDS
);

export type EntityListColumnRegistryKey = "customer" | "supplier";

export function getEntityListColumnRegistry(
  key: EntityListColumnRegistryKey
): ListColumnRegistry<EntityListColumnId> {
  return key === "customer" ? CUSTOMER_LIST_COLUMN_REGISTRY : SUPPLIER_LIST_COLUMN_REGISTRY;
}

export function getEntityColumnDef(id: EntityListColumnId): EntityListColumnDef {
  return ENTITY_LIST_COLUMNS.find((column) => column.id === id)!;
}

export function workspaceDefaultColumnIds(
  workspace: EntityCommercialType | "customer" | "supplier"
): readonly EntityListColumnId[] {
  if (workspace === "customer" || workspace === "CUSTOMER") {
    return CUSTOMER_LIST_COLUMN_IDS;
  }
  return SUPPLIER_LIST_COLUMN_IDS;
}
