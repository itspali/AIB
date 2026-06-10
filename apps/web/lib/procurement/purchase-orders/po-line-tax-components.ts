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
  cess_amount: number;
  components: PoLineTaxComponentEntry[];
};

export type PoLineTaxComponentDisplayOptions = PurchaseOrderTotalsOptions & {
  taxSupplyNature?: PoTaxSupplyNature;
};

type TaxComponentBucket = "CGST" | "SGST" | "IGST" | "CESS";

function roundMoney(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function taxComponentBucket(name: string): TaxComponentBucket | null {
  const upper = name.trim().toUpperCase();
  if (upper.startsWith("CGST")) return "CGST";
  if (upper.startsWith("SGST")) return "SGST";
  if (upper.startsWith("IGST")) return "IGST";
  if (upper.startsWith("CESS")) return "CESS";
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

/** When tax_code_components is empty, derive statutory split from the code's flat rate. */
export function synthesizeGstComponentsFromFlatRate(
  totalRate: number,
  supplyNature: PoTaxSupplyNature
): TaxComponentRow[] {
  if (!Number.isFinite(totalRate) || totalRate <= 0) return [];

  if (supplyNature === "INTRASTATE") {
    const half = totalRate / 2;
    return [
      { name: "CGST", rate: half, sort_order: 0 },
      { name: "SGST", rate: half, sort_order: 1 },
    ];
  }

  return [{ name: "IGST", rate: totalRate, sort_order: 0 }];
}

export function resolveEffectiveTaxComponents(
  components: TaxComponentRow[],
  flatTaxRate: number,
  supplyNature: PoTaxSupplyNature
): TaxComponentRow[] {
  const matched = filterTaxComponentsForSupply(components, supplyNature);
  if (matched.length > 0) return matched;
  return synthesizeGstComponentsFromFlatRate(flatTaxRate, supplyNature);
}

export function resolvePoLineTaxComponentBreakdown(input: {
  taxableBase: number;
  lineTaxAmount: number;
  components: TaxComponentRow[];
  supplyNature: PoTaxSupplyNature;
  flatTaxRate?: number;
}): PoLineTaxComponentBreakdown {
  const flatTaxRate = input.flatTaxRate ?? 0;
  const filtered = resolveEffectiveTaxComponents(
    input.components,
    flatTaxRate,
    input.supplyNature
  );
  if (filtered.length === 0 || input.taxableBase <= 0 || input.lineTaxAmount <= 0) {
    return { cgst_amount: 0, sgst_amount: 0, igst_amount: 0, cess_amount: 0, components: [] };
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
  let cess_amount = 0;
  for (const entry of entries) {
    const bucket = taxComponentBucket(entry.name);
    if (bucket === "CGST") cgst_amount += entry.amount;
    else if (bucket === "SGST") sgst_amount += entry.amount;
    else if (bucket === "IGST") igst_amount += entry.amount;
    else if (bucket === "CESS") cess_amount += entry.amount;
  }

  return {
    cgst_amount: roundMoney(cgst_amount),
    sgst_amount: roundMoney(sgst_amount),
    igst_amount: roundMoney(igst_amount),
    cess_amount: roundMoney(cess_amount),
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
  let cess_amount = 0;
  for (const entry of components) {
    const bucket = taxComponentBucket(entry.name);
    if (bucket === "CGST") cgst_amount += entry.amount;
    else if (bucket === "SGST") sgst_amount += entry.amount;
    else if (bucket === "IGST") igst_amount += entry.amount;
    else if (bucket === "CESS") cess_amount += entry.amount;
  }
  return {
    cgst_amount: roundMoney(cgst_amount),
    sgst_amount: roundMoney(sgst_amount),
    igst_amount: roundMoney(igst_amount),
    cess_amount: roundMoney(cess_amount),
    components,
  };
}

function resolveDraftBreakdown(
  line: PoDraftLine,
  options: PoLineTaxComponentDisplayOptions
): PoLineTaxComponentBreakdown | null {
  if (!line.variant_id) return null;
  if (line.catalog_context?.tax_is_variable) return null;

  const supplyNature = options.taxSupplyNature ?? "INTERSTATE";
  const resolved = resolvePoLineTaxAmount(line, options);
  if (resolved.taxAmount <= 0) return null;

  return resolvePoLineTaxComponentBreakdown({
    taxableBase: resolved.taxableBase,
    lineTaxAmount: resolved.taxAmount,
    components: line.catalog_context?.tax_components ?? [],
    supplyNature,
    flatTaxRate: line.catalog_context?.tax_rate ?? 0,
  });
}

function resolvePeekBreakdown(
  line: PurchaseOrderLineRow,
  supplyNature: PoTaxSupplyNature
): PoLineTaxComponentBreakdown {
  if (line.tax_components.length > 0) {
    return breakdownFromPersistedComponents(line.tax_components);
  }

  const lineTaxAmount = Number(line.line_tax_amount);
  const taxableBase = Number(line.line_total_gross);
  const flatTaxRate = Number(line.tax_rate_percentage);

  if (!Number.isFinite(lineTaxAmount) || lineTaxAmount <= 0) {
    return { cgst_amount: 0, sgst_amount: 0, igst_amount: 0, cess_amount: 0, components: [] };
  }

  return resolvePoLineTaxComponentBreakdown({
    taxableBase: Number.isFinite(taxableBase) ? taxableBase : 0,
    lineTaxAmount,
    components: [],
    supplyNature,
    flatTaxRate: Number.isFinite(flatTaxRate) ? flatTaxRate : 0,
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
  column: DocumentColumnPref,
  supplyNature: PoTaxSupplyNature = "INTERSTATE"
): string {
  const breakdown = resolvePeekBreakdown(line, supplyNature);
  return formatComponentAmount(breakdown.cgst_amount, column);
}

export function resolvePoPeekLineSgstAmountDisplay(
  line: PurchaseOrderLineRow,
  column: DocumentColumnPref,
  supplyNature: PoTaxSupplyNature = "INTERSTATE"
): string {
  const breakdown = resolvePeekBreakdown(line, supplyNature);
  return formatComponentAmount(breakdown.sgst_amount, column);
}

export function resolvePoPeekLineIgstAmountDisplay(
  line: PurchaseOrderLineRow,
  column: DocumentColumnPref,
  supplyNature: PoTaxSupplyNature = "INTERSTATE"
): string {
  const breakdown = resolvePeekBreakdown(line, supplyNature);
  return formatComponentAmount(breakdown.igst_amount, column);
}
