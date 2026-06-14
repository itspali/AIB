import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { isPromotionalPoLine } from "@/lib/procurement/purchase-orders/po-promo";
import { resolvePoLineMrp } from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import {
  resolvePoDraftLineUomCode,
  resolvePoLineUomOptions,
} from "@/lib/procurement/purchase-orders/po-line-uom-options";

export type PoCatalogWritebackField =
  | "mrp"
  | "purchase_price"
  | "supplier_price"
  | "purchase_uom"
  | "hsn_sac_code"
  | "tax_code";

export type PoCatalogWritebackRow = {
  id: string;
  lineKey: string;
  itemId: string;
  variantId: string;
  itemName: string;
  variantSku: string;
  field: PoCatalogWritebackField;
  fieldLabel: string;
  catalogValue: string | null;
  proposedValue: string;
  /** Server payload when it differs from display text (e.g. tax code id). */
  applyValue?: string;
};

export type PoCatalogWritebackSelection = {
  lineKey: string;
  field: PoCatalogWritebackField;
};

export const PO_CATALOG_WRITEBACK_FIELDS: ReadonlyArray<{
  field: PoCatalogWritebackField;
  label: string;
  shortLabel: string;
}> = [
  { field: "mrp", label: "MRP", shortLabel: "MRP" },
  { field: "purchase_price", label: "Purchase price", shortLabel: "Purchase" },
  { field: "supplier_price", label: "Supplier catalog price", shortLabel: "Supplier" },
  { field: "purchase_uom", label: "Purchase unit", shortLabel: "Unit" },
  { field: "hsn_sac_code", label: "HSN/SAC", shortLabel: "HSN/SAC" },
  { field: "tax_code", label: "Tax %", shortLabel: "Tax %" },
];

export type PoCatalogWritebackGroup = {
  id: string;
  lineKey: string;
  itemId: string;
  variantId: string;
  itemName: string;
  variantSku: string;
  fields: Partial<Record<PoCatalogWritebackField, PoCatalogWritebackRow>>;
};

const PRICE_TOLERANCE = 0.0001;

function parseAmount(value: string | null | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function amountsDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = parseAmount(a);
  const right = parseAmount(b);
  if (left == null && right == null) return false;
  if (left == null || right == null) return true;
  return Math.abs(left - right) > PRICE_TOLERANCE;
}

function normalizeUom(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function uomsDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeUom(a) !== normalizeUom(b);
}

function rowId(lineKey: string, field: PoCatalogWritebackField): string {
  return `${lineKey}:${field}`;
}

function pushRow(
  rows: PoCatalogWritebackRow[],
  line: PoDraftLine,
  field: PoCatalogWritebackField,
  fieldLabel: string,
  catalogValue: string | null,
  proposedValue: string,
  applyValue?: string
) {
  rows.push({
    id: rowId(line.key, field),
    lineKey: line.key,
    itemId: line.item_id!,
    variantId: line.variant_id!,
    itemName: line.item_name,
    variantSku: line.variant_sku,
    field,
    fieldLabel,
    catalogValue,
    proposedValue,
    ...(applyValue ? { applyValue } : {}),
  });
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function textsDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeText(a) !== normalizeText(b);
}

function formatWritebackTaxRateDisplay(rate: number | string | null | undefined): string | null {
  if (rate == null || rate === "") return null;
  const parsed = typeof rate === "number" ? rate : Number(String(rate).replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return `${parsed.toFixed(2)}%`;
}

export function buildPoCatalogWritebackRows(lines: PoDraftLine[]): PoCatalogWritebackRow[] {
  const rows: PoCatalogWritebackRow[] = [];

  for (const line of lines) {
    if (!line.variant_id || !line.item_id) continue;
    if (isPromotionalPoLine(line)) continue;

    const snapshot = line.writeback_snapshot;
    const unitPrice = line.unit_price_contractual?.trim() || "0";
    const effectiveMrp = resolvePoLineMrp(line);
    const proposedMrp = effectiveMrp > 0 ? String(effectiveMrp) : null;
    const proposedUom = resolvePoDraftLineUomCode(line);
    const catalogUom = snapshot?.catalog_purchase_uom ?? null;
    const uomOptions = resolvePoLineUomOptions(line);
    const uomAllowed =
      proposedUom != null &&
      uomOptions.some((option) => option.uom_code === proposedUom);

    if (proposedMrp && amountsDiffer(snapshot?.catalog_mrp, proposedMrp)) {
      pushRow(rows, line, "mrp", "MRP", snapshot?.catalog_mrp ?? null, proposedMrp);
    }

    if (
      parseAmount(unitPrice) != null &&
      parseAmount(unitPrice)! > 0 &&
      amountsDiffer(snapshot?.catalog_purchase_price, unitPrice)
    ) {
      pushRow(
        rows,
        line,
        "purchase_price",
        "Purchase price",
        snapshot?.catalog_purchase_price ?? null,
        unitPrice
      );
    }

    if (
      parseAmount(unitPrice) != null &&
      parseAmount(unitPrice)! > 0 &&
      amountsDiffer(snapshot?.catalog_supplier_price, unitPrice)
    ) {
      pushRow(
        rows,
        line,
        "supplier_price",
        "Supplier catalog price",
        snapshot?.catalog_supplier_price ?? null,
        unitPrice
      );
    }

    if (uomAllowed && uomsDiffer(catalogUom, proposedUom)) {
      pushRow(
        rows,
        line,
        "purchase_uom",
        "Purchase unit",
        catalogUom,
        proposedUom!
      );
    }

    const proposedHsn = line.catalog_context?.hsn_sac_code?.trim() || null;
    if (textsDiffer(snapshot?.catalog_hsn_sac_code, proposedHsn) && proposedHsn) {
      pushRow(
        rows,
        line,
        "hsn_sac_code",
        "HSN/SAC",
        snapshot?.catalog_hsn_sac_code ?? null,
        proposedHsn
      );
    }

    const proposedTaxCodeId = line.catalog_context?.tax_code_id?.trim() || null;
    if (proposedTaxCodeId && textsDiffer(snapshot?.catalog_tax_code_id, proposedTaxCodeId)) {
      const catalogTaxDisplay = formatWritebackTaxRateDisplay(snapshot?.catalog_tax_rate);
      const proposedTaxDisplay =
        formatWritebackTaxRateDisplay(line.catalog_context?.tax_rate) ?? proposedTaxCodeId;
      pushRow(
        rows,
        line,
        "tax_code",
        "Tax %",
        catalogTaxDisplay,
        proposedTaxDisplay,
        proposedTaxCodeId
      );
    }
  }

  return rows;
}

/** One matrix row per PO line — item header once, field deltas keyed by column. */
export function groupPoCatalogWritebackRows(
  rows: PoCatalogWritebackRow[]
): PoCatalogWritebackGroup[] {
  const grouped = new Map<string, PoCatalogWritebackGroup>();

  for (const row of rows) {
    const existing = grouped.get(row.lineKey);
    if (existing) {
      existing.fields[row.field] = row;
      continue;
    }
    grouped.set(row.lineKey, {
      id: row.lineKey,
      lineKey: row.lineKey,
      itemId: row.itemId,
      variantId: row.variantId,
      itemName: row.itemName,
      variantSku: row.variantSku,
      fields: { [row.field]: row },
    });
  }

  return [...grouped.values()];
}

export function writebackGroupSelectableIds(group: PoCatalogWritebackGroup): string[] {
  return PO_CATALOG_WRITEBACK_FIELDS.map(({ field }) => group.fields[field]?.id).filter(
    (id): id is string => id != null
  );
}

export function writebackColumnSelectableIds(
  groups: PoCatalogWritebackGroup[],
  field: PoCatalogWritebackField
): string[] {
  return groups
    .map((group) => group.fields[field]?.id)
    .filter((id): id is string => id != null);
}

export function resolveWritebackBulkCheckboxState(
  ids: string[],
  selectedIds: Set<string>
): boolean | "indeterminate" {
  if (ids.length === 0) return false;
  const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
  if (selectedCount === 0) return false;
  if (selectedCount === ids.length) return true;
  return "indeterminate";
}

export function formatWritebackCatalogValue(value: string | null): string {
  if (!value?.trim()) return "—";
  return value;
}
