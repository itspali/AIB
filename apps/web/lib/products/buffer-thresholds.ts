import {
  extractReorderPointFromCustomFieldsRecord,
  normalizeCatalogQuantityField,
} from "@/lib/products/catalog-reserved-fields";

export type BufferThresholdCell = {
  variant_id: string;
  location_id: string;
  reorder_point_qty: string;
};

export type BufferThresholdOverride = {
  variant_id: string;
  location_id: string;
  reorder_point_qty: string;
};

export function bufferCellKey(variantId: string, locationId: string): string {
  return `${variantId}:${locationId}`;
}

export function formatBufferQuantity(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;
  return String(parsed);
}

export function parseBufferInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return String(parsed);
}

export function resolveBufferReorderDisplay(
  overrideQty: string | undefined,
  defaultReorderPoint: string
): { value: string; inherited: boolean; placeholder: string } {
  const defaultQty = normalizeCatalogQuantityField(defaultReorderPoint);
  if (overrideQty != null && overrideQty !== "") {
    return {
      value: overrideQty,
      inherited: false,
      placeholder: defaultQty || "Default",
    };
  }
  return {
    value: "",
    inherited: true,
    placeholder: defaultQty || "Default",
  };
}

function reorderPointCompareKey(value: string | null | undefined): string {
  const normalized = normalizeCatalogQuantityField(value ?? "");
  if (!normalized) return "";
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return normalized;
  return String(parsed);
}

export function normalizeReorderPointForCompare(value: string | null | undefined): string {
  return reorderPointCompareKey(value);
}

export function reorderPointChanged(
  previousValue: string | null | undefined,
  nextValue: string | null | undefined
): boolean {
  return reorderPointCompareKey(previousValue) !== reorderPointCompareKey(nextValue);
}

export function extractStoredReorderPoint(
  customFields: Record<string, unknown> | null | undefined
): string {
  return extractReorderPointFromCustomFieldsRecord(customFields);
}

export function buildBufferThresholdSaveRows(
  variantIds: string[],
  locationIds: string[],
  cells: Record<string, string>,
  overrides: Record<string, boolean>
): BufferThresholdCell[] {
  const rows: BufferThresholdCell[] = [];

  for (const variantId of variantIds) {
    for (const locationId of locationIds) {
      const key = bufferCellKey(variantId, locationId);
      const hadOverride = overrides[key] ?? false;
      const nextValue = cells[key] ?? "";
      const parsed = parseBufferInput(nextValue);

      if (parsed == null) {
        if (hadOverride) {
          rows.push({ variant_id: variantId, location_id: locationId, reorder_point_qty: "" });
        }
        continue;
      }

      rows.push({
        variant_id: variantId,
        location_id: locationId,
        reorder_point_qty: parsed,
      });
    }
  }

  return rows;
}
