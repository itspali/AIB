import {
  formatDocumentDecimal,
  normalizeDocumentDecimalInput,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";

export const PO_LINE_MRP_MARKDOWN_CUSTOM_FIELD_KEY = "mrp_markdown_percentage";

function parsePositiveAmount(value: string | undefined | null): number {
  const parsed = Number((value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseNonNegativeAmount(value: string | undefined | null): number {
  const parsed = Number((value ?? "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** MRP reference for the line (from hydrated catalog snapshot). */
export function resolvePoLineMrp(line: Pick<PoDraftLine, "catalog_context">): number {
  return parsePositiveAmount(line.catalog_context?.mrp ?? null);
}

export function shouldShowPoMrpTradeTermsStack(
  line: Pick<PoDraftLine, "variant_id" | "catalog_context">,
  enabled = true
): boolean {
  if (!enabled || !line.variant_id) return false;
  return resolvePoLineMrp(line) > 0;
}

/** Offer unit price from MRP and trade markdown percent. */
export function computeOfferUnitFromMrpMarkdown(
  mrp: number,
  markdownPct: number,
  decimalPlaces = 2
): string {
  if (mrp <= 0) return "0";
  const clampedPct = Math.min(Math.max(markdownPct, 0), 100);
  const offer = mrp * (1 - clampedPct / 100);
  return Math.max(offer, 0).toFixed(decimalPlaces);
}

/** Implied trade markdown % when the user edits offer unit price directly. */
export function computeImpliedMrpMarkdownPct(mrp: number, unitPrice: number): string {
  if (mrp <= 0) return "0";
  const unit = Math.max(unitPrice, 0);
  // Unset/zero offer is not "100% off MRP" — treat as no trade markdown entered yet.
  if (unit <= 0) return "0";
  const pct = ((mrp - unit) / mrp) * 100;
  return formatDocumentDecimal(Math.min(Math.max(pct, 0), 100), 2);
}

export function resolvePoLineMrpMarkdownPercentage(line: PoDraftLine): string {
  const mrp = resolvePoLineMrp(line);
  const unit = parseNonNegativeAmount(line.unit_price_contractual);
  if (mrp <= 0) return "0";

  const explicit = line.mrp_markdown_percentage?.trim();
  if (explicit && (unit > 0 || parseNonNegativeAmount(explicit) > 0)) {
    return explicit;
  }

  return computeImpliedMrpMarkdownPct(mrp, unit);
}

export function patchPoLineMrpMarkdownPercentage(
  line: PoDraftLine,
  markdownPctRaw: string,
  priceColumn: DocumentColumnPref
): Pick<PoDraftLine, "mrp_markdown_percentage" | "unit_price_contractual"> {
  const decimalPlaces = resolveColumnDecimalPlaces(priceColumn);
  const markdownPct = parseNonNegativeAmount(
    normalizeDocumentDecimalInput(markdownPctRaw, 2)
  );
  const mrp = resolvePoLineMrp(line);
  const clampedPct = Math.min(markdownPct, 100);

  return {
    mrp_markdown_percentage: formatDocumentDecimal(clampedPct, 2),
    unit_price_contractual:
      mrp > 0
        ? computeOfferUnitFromMrpMarkdown(mrp, clampedPct, decimalPlaces)
        : line.unit_price_contractual,
  };
}

function parseDraftDecimal(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Live draft while typing — preserves raw input (no fixed decimal padding). */
export function patchPoLineOfferUnitPriceDraft(
  line: PoDraftLine,
  unitPriceRaw: string
): Pick<PoDraftLine, "mrp_markdown_percentage" | "unit_price_contractual"> {
  const mrp = resolvePoLineMrp(line);
  const parsed = parseDraftDecimal(unitPriceRaw);

  return {
    unit_price_contractual: unitPriceRaw,
    mrp_markdown_percentage:
      mrp > 0
        ? parsed != null && parsed > 0
          ? computeImpliedMrpMarkdownPct(mrp, parsed)
          : "0"
        : line.mrp_markdown_percentage ?? "0",
  };
}

export function patchPoLineOfferUnitPrice(
  line: PoDraftLine,
  unitPriceRaw: string,
  priceColumn: DocumentColumnPref
): Pick<PoDraftLine, "mrp_markdown_percentage" | "unit_price_contractual"> {
  const decimalPlaces = resolveColumnDecimalPlaces(priceColumn);
  const normalized = normalizeDocumentDecimalInput(unitPriceRaw, decimalPlaces);
  const mrp = resolvePoLineMrp(line);

  return {
    unit_price_contractual: normalized,
    mrp_markdown_percentage:
      mrp > 0
        ? computeImpliedMrpMarkdownPct(mrp, parseNonNegativeAmount(normalized))
        : line.mrp_markdown_percentage ?? "0",
  };
}

/** Live draft while typing markdown % — does not pad decimals. */
export function patchPoLineMrpMarkdownPercentageDraft(
  line: PoDraftLine,
  markdownPctRaw: string,
  priceColumn: DocumentColumnPref
): Pick<PoDraftLine, "mrp_markdown_percentage" | "unit_price_contractual"> {
  const decimalPlaces = resolveColumnDecimalPlaces(priceColumn);
  const mrp = resolvePoLineMrp(line);
  const parsed = parseDraftDecimal(markdownPctRaw);
  const clampedPct = parsed == null ? 0 : Math.min(parsed, 100);

  const offer =
    mrp > 0 && parsed != null
      ? Math.max(mrp * (1 - clampedPct / 100), 0).toFixed(decimalPlaces)
      : null;

  return {
    mrp_markdown_percentage: markdownPctRaw,
    unit_price_contractual: offer ?? line.unit_price_contractual,
  };
}

/** After supplier/catalog price pre-fill, align markdown % with the offer price. */
export function syncPoLineMrpMarkdownFromOfferPrice(
  line: PoDraftLine
): Pick<PoDraftLine, "mrp_markdown_percentage"> | null {
  const mrp = resolvePoLineMrp(line);
  if (mrp <= 0) return null;
  const unit = parseNonNegativeAmount(line.unit_price_contractual);
  return {
    mrp_markdown_percentage: computeImpliedMrpMarkdownPct(mrp, unit),
  };
}

export function formatPoLineMrpReference(mrp: number, decimalPlaces = 2): string {
  return formatDocumentDecimal(mrp, decimalPlaces);
}

export function resolvePeekLineMrp(
  line: Pick<PurchaseOrderLineRow, "mrp">
): number {
  return parsePositiveAmount(line.mrp ?? null);
}

export function shouldShowPeekMrpTradeTermsStack(
  line: Pick<PurchaseOrderLineRow, "mrp">,
  enabled = true
): boolean {
  if (!enabled) return false;
  return resolvePeekLineMrp(line) > 0;
}

export function resolvePeekLineMrpMarkdownPct(
  line: Pick<PurchaseOrderLineRow, "mrp" | "unit_price_contractual">
): string | null {
  const mrp = resolvePeekLineMrp(line);
  if (mrp <= 0) return null;
  const unit = parseNonNegativeAmount(line.unit_price_contractual);
  return computeImpliedMrpMarkdownPct(mrp, unit);
}
