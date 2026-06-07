import {
  BOOLEAN_ACTIVE_INACTIVE_CATALOG,
} from "@/lib/list-columns/chip-colors";
import { columnWidths } from "@/lib/list-columns/sizing";
import type { ListColumnDef, ListColumnRegistry } from "@/lib/list-columns/types";
import { CHIP_DEFAULT_FALLBACK_KEY } from "@/lib/list-columns/types";
import { PRESENCE_ENVIRONMENTS } from "@/lib/locations/types";

export const LOCATION_LIST_COLUMN_IDS = [
  "is_active",
  "presence_type",
  "central_hq",
] as const;

export type LocationListColumnId = (typeof LOCATION_LIST_COLUMN_IDS)[number];

export type LocationListColumnDef = ListColumnDef<LocationListColumnId>;

const W_STATUS = columnWidths({
  default: { min: 96, max: 112 },
});

const ACTIVE_INACTIVE_DEFAULTS = {
  true: { preset: "emerald" as const },
  false: { preset: "red" as const },
  [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" as const },
};

const PRESENCE_CHIP_CATALOG = PRESENCE_ENVIRONMENTS.map((value) => ({
  value,
  label: value === "VIRTUAL" ? "Virtual" : "Physical",
}));

export const LOCATION_LIST_COLUMNS: LocationListColumnDef[] = [
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
    id: "presence_type",
    label: "Presence",
    defaultVisible: true,
    group: "Identity",
    chipEligible: true,
    chipValueCatalog: PRESENCE_CHIP_CATALOG,
    chipDefaultColors: {
      PHYSICAL: { preset: "slate" },
      VIRTUAL: { preset: "indigo" },
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
  },
  {
    id: "central_hq",
    label: "Central HQ",
    defaultVisible: true,
    align: "center",
    group: "Identity",
    chipEligible: true,
    chipValueCatalog: [
      { value: "true", label: "Central HQ" },
      { value: "false", label: "Not HQ" },
    ],
    chipDefaultColors: {
      true: { preset: "indigo" },
      false: { preset: "neutral" },
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
  },
];

export const LOCATION_LIST_COLUMN_REGISTRY: ListColumnRegistry<LocationListColumnId> = {
  ids: LOCATION_LIST_COLUMN_IDS,
  columns: LOCATION_LIST_COLUMNS,
  storageKey: "aib-location-list-prefs",
};

export function getLocationColumnDef(id: LocationListColumnId): LocationListColumnDef {
  return LOCATION_LIST_COLUMNS.find((column) => column.id === id)!;
}
