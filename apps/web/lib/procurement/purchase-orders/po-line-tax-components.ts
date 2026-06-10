import {
  formatDocumentDecimal,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import {
  resolvePoLineTaxAmount,
  type PurchaseOrderTotalsOptions,
} from "@/lib/procurement/purchase-orders/totals";
import type { TaxComponentRow } from "@/lib/tax/types";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";

export type PoLineTaxComponentEntry = {
  name: string;
  rate: number;
  amount: number;
};

export type PoLineTaxComponentBreakdown = {
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  components: PoLineTaxComponentEntry[];
};

export type PoLineTaxComponentDisplayOptions = PurchaseOrderTotalsOptions & {
  taxSupplyNature?: PoTaxSupplyNature;
};

type TaxComponentBucket = "CGST" | "SGST" | "IGST";

function roundMoney(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function taxComponentBucket(name: string): TaxComponentBucket | null {
  const upper = name.trim().toUpperCase();
  if (upper.startsWith("CGST")) return "CGST";
  if (upper.startsWith("SGST")) return "SGST";
  if (upper.startsWith("IGST")) return "IGST";
  return null;
}

export function filterTaxComponentsForSupply(
  components: TaxComponentRow[],
  supplyNature: PoTaxSupplyNature
): TaxComponentRow[] {
  return components.filter((component) => {
    const bucket = taxComponentBucket(component.name);
    if (supplyNature === "INTRASTATE") {
      return bucket === "CGST" || bucket === "SGST";
    }
    return bucket === "IGST";
  });
}

export function resolvePoLineTaxComponentBreakdown(input: {
  taxableBase: number;
  lineTaxAmount: number;
  components: TaxComponentRow[];
  supplyNature: PoTaxSupplyNature;
}): PoLineTaxComponentBreakdown {
  const filtered = filterTaxComponentsForSupply(input.components, input.supplyNature);
  if (filtered.length === 0 || input.taxableBase <= 0 || input.lineTaxAmount <= 0) {
    return { cgst_amount: 0, sgst_amount: 0, igst_amount: 0, components: [] };
  }

  const entries: PoLineTaxComponentEntry[] = filtered.map((component) => ({
    name: component.name,
    rate: component.rate,
    amount: roundMoney((input.taxableBase * component.rate) / 100),
  }));

  const sum = entries.reduce((total, entry) => total + entry.amount, 0);
  const drift = roundMoney(input.lineTaxAmount - sum);
  if (drift !== 0 && entries.length > 0) {
    entries[entries.length - 1].amount = roundMoney(
      entries[entries.length - 1].amount + drift
    );
  }

  let cgst_amount = 0;
  let sgst_amount = 0;
  let igst_amount = 0;
  for (const entry of entries) {
    const bucket = taxComponentBucket(entry.name);
    if (bucket === "CGST") cgst_amount += entry.amount;
    else if (bucket === "SGST") sgst_amount += entry.amount;
    else if (bucket === "IGST") igst_amount += entry.amount;
  }

  return {
    cgst_amount: roundMoney(cgst_amount),
    sgst_amount: roundMoney(sgst_amount),
    igst_amount: roundMoney(igst_amount),
    components: entries,
  };
}

export function parsePoLineTaxComponentsJson(
  raw: unknown
): PoLineTaxComponentEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const rate = Number(row.rate);
      const amount = Number(row.amount);
      if (!name || !Number.isFinite(rate) || !Number.isFinite(amount)) return null;
      return { name, rate, amount };
    })
    .filter((entry): entry is PoLineTaxComponentEntry => entry != null);
}

function breakdownFromPersistedComponents(
  components: PoLineTaxComponentEntry[]
): PoLineTaxComponentBreakdown {
  let cgst_amount = 0;
  let sgst_amount = 0;
  let igst_amount = 0;
  for (const entry of components) {
    const bucket = taxComponentBucket(entry.name);
    if (bucket === "CGST") cgst_amount += entry.amount;
    else if (bucket === "SGST") sgst_amount += entry.amount;
    else if (bucket === "IGST") igst_amount += entry.amount;
  }
  return {
    cgst_amount: roundMoney(cgst_amount),
    sgst_amount: roundMoney(sgst_amount),
    igst_amount: roundMoney(igst_amount),
    components,
  };
}

function resolveDraftBreakdown(
  line: PoDraftLine,
  options: PoLineTaxComponentDisplayOptions
): PoLineTaxComponentBreakdown | null {
  if (!line.variant_id) return null;
  if (line.catalog_context?.tax_is_variable) return null;
  const components = line.catalog_context?.tax_components ?? [];
  if (components.length === 0) return null;

  const supplyNature = options.taxSupplyNature ?? "INTERSTATE";
  const resolved = resolvePoLineTaxAmount(line, options);
  return resolvePoLineTaxComponentBreakdown({
    taxableBase: resolved.taxableBase,
    lineTaxAmount: resolved.taxAmount,
    components,
    supplyNature,
  });
}

function formatComponentAmount(
  amount: number,
  column: DocumentColumnPref
): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return formatDocumentDecimal(0, resolveColumnDecimalPlaces(column));
  }
  return formatDocumentDecimal(amount, resolveColumnDecimalPlaces(column));
}

export function resolvePoDraftLineCgstAmountDisplay(
  line: PoDraftLine,
  column: DocumentColumnPref,
  options: PoLineTaxComponentDisplayOptions = {}
): string {
  const breakdown = resolveDraftBreakdown(line, options);
  return formatComponentAmount(breakdown?.cgst_amount ?? 0, column);
}

export function resolvePoDraftLineSgstAmountDisplay(
  line: PoDraftLine,
  column: DocumentColumnPref,
  options: PoLineTaxComponentDisplayOptions = {}
): string {
  const breakdown = resolveDraftBreakdown(line, options);
  return formatComponentAmount(breakdown?.sgst_amount ?? 0, column);
}

export function resolvePoDraftLineIgstAmountDisplay(
  line: PoDraftLine,
  column: DocumentColumnPref,
  options: PoLineTaxComponentDisplayOptions = {}
): string {
  const breakdown = resolveDraftBreakdown(line, options);
  return formatComponentAmount(breakdown?.igst_amount ?? 0, column);
}

export function resolvePoPeekLineCgstAmountDisplay(
  line: PurchaseOrderLineRow,
  column: DocumentColumnPref
): string {
  const breakdown = breakdownFromPersistedComponents(line.tax_components);
  return formatComponentAmount(breakdown.cgst_amount, column);
}

export function resolvePoPeekLineSgstAmountDisplay(
  line: PurchaseOrderLineRow,
  column: DocumentColumnPref
): string {
  const breakdown = breakdownFromPersistedComponents(line.tax_components);
  return formatComponentAmount(breakdown.sgst_amount, column);
}

export function resolvePoPeekLineIgstAmountDisplay(
  line: PurchaseOrderLineRow,
  column: DocumentColumnPref
): string {
  const breakdown = breakdownFromPersistedComponents(line.tax_components);
  return formatComponentAmount(breakdown.igst_amount, column);
}
