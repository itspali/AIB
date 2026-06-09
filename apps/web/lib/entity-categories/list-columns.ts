import {
  BOOLEAN_ACTIVE_INACTIVE_CATALOG,
  BOOLEAN_YES_NO_CATALOG,
} from "@/lib/list-columns/chip-colors";
import { columnWidths } from "@/lib/list-columns/sizing";
import type { ListColumnDef, ListColumnRegistry } from "@/lib/list-columns/types";
import { CHIP_DEFAULT_FALLBACK_KEY } from "@/lib/list-columns/types";
import { getEntityCategoryWorkspaceConfig } from "@/lib/entity-categories/config";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";

export const ENTITY_CATEGORY_LIST_COLUMN_IDS = [
  "name",
  "parent_name",
  "is_active",
  "entity_count",
  "attribute_count",
  "inherit_parent_attributes",
  "created_at",
  "updated_at",
] as const;

export type EntityCategoryListColumnId = (typeof ENTITY_CATEGORY_LIST_COLUMN_IDS)[number];

export type EntityCategoryListColumnDef = ListColumnDef<EntityCategoryListColumnId>;

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
  default: { min: 72, max: 96 },
  desktop: { min: 80, max: 108 },
});

const W_BOOLEAN = columnWidths({
  default: { min: 88, max: 132 },
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

function buildEntityCategoryListColumns(
  workspace: EntityCategoryWorkspace
): EntityCategoryListColumnDef[] {
  const { entityNounPlural } = getEntityCategoryWorkspaceConfig(workspace);
  const entityLabel = entityNounPlural.charAt(0).toUpperCase() + entityNounPlural.slice(1);

  return [
    {
      id: "name",
      label: "Name",
      defaultVisible: true,
      group: "Identity",
      valueKind: "text",
      widths: W_NAME,
    },
    {
      id: "parent_name",
      label: "Parent",
      defaultVisible: true,
      group: "Identity",
      valueKind: "text",
      widths: W_TEXT,
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
      id: "entity_count",
      label: entityLabel,
      defaultVisible: true,
      align: "right",
      group: "Usage",
      valueKind: "number",
      widths: W_NUMBER,
    },
    {
      id: "attribute_count",
      label: "Attributes",
      defaultVisible: false,
      align: "right",
      group: "Schema",
      valueKind: "number",
      widths: W_NUMBER,
    },
    {
      id: "inherit_parent_attributes",
      label: "Inherits parent",
      defaultVisible: false,
      align: "center",
      group: "Schema",
      widths: W_BOOLEAN,
      chipEligible: true,
      chipValueCatalog: BOOLEAN_YES_NO_CATALOG,
      chipDefaultColors: BOOLEAN_YES_NO_DEFAULTS,
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
}

const REGISTRY_CACHE = new Map<EntityCategoryWorkspace, ListColumnRegistry<EntityCategoryListColumnId>>();

export function getEntityCategoryListColumnRegistry(
  workspace: EntityCategoryWorkspace
): ListColumnRegistry<EntityCategoryListColumnId> {
  const cached = REGISTRY_CACHE.get(workspace);
  if (cached) return cached;

  const columns = buildEntityCategoryListColumns(workspace);
  const registry: ListColumnRegistry<EntityCategoryListColumnId> = {
    ids: ENTITY_CATEGORY_LIST_COLUMN_IDS,
    columns,
    storageKey: getEntityCategoryWorkspaceConfig(workspace).listPrefsStorageKey,
  };
  REGISTRY_CACHE.set(workspace, registry);
  return registry;
}

export function getEntityCategoryColumnDef(
  workspace: EntityCategoryWorkspace,
  id: EntityCategoryListColumnId
): EntityCategoryListColumnDef {
  return getEntityCategoryListColumnRegistry(workspace).columns.find((column) => column.id === id)!;
}
