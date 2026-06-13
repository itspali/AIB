import {
  formatDocumentDecimal,
  normalizeDocumentDecimalInput,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";

export const PO_LINE_MRP_MARKDOWN_CUSTOM_FIELD_KEY = "mrp_markdown_percentage";

export type PoLineMrpVarianceDirection = "above" | "below";

function parsePositiveAmount(value: string | undefined | null): number {
  const parsed = Number((value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseNonNegativeAmount(value: string | undefined | null): number {
  const parsed = Number((value ?? "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseSignedAmount(value: string | undefined | null): number {
  const parsed = Number(String(value ?? "").trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSignedDraftDecimal(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed || trimmed === "-" || trimmed === "+" || trimmed === "." || trimmed === "-.") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** MRP reference for the line (PO entry when catalog blank, else catalog snapshot). */
export function resolvePoLineMrp(line: Pick<PoDraftLine, "catalog_context" | "mrp_reference">): number {
  if (line.mrp_reference != null && line.mrp_reference.trim() !== "") {
    const draft = parseDraftDecimal(line.mrp_reference);
    if (draft != null && draft > 0) return draft;
    const reference = parsePositiveAmount(line.mrp_reference);
    if (reference > 0) return reference;
  }
  return parsePositiveAmount(line.catalog_context?.mrp ?? null);
}

/** @deprecated use resolvePoLineMrp — kept for call-site clarity in catalog-only reads */
export function resolvePoLineMrpFromCatalog(line: Pick<PoDraftLine, "catalog_context">): number {
  return parsePositiveAmount(line.catalog_context?.mrp ?? null);
}

/** Offer vs MRP — red up when above, green down when below, none when equal/unset. */
export function resolvePoLineMrpVarianceDirection(
  mrp: number,
  unitPrice: number
): PoLineMrpVarianceDirection | null {
  if (mrp <= 0) return null;
  if (unitPrice <= 0) return "below";
  if (unitPrice > mrp) return "above";
  if (unitPrice < mrp) return "below";
  return null;
}

export function shouldShowPoMrpTradeTermsStack(
  line: Pick<PoDraftLine, "variant_id" | "catalog_context" | "mrp_reference">,
  enabled = true
): boolean {
  if (!enabled || !line.variant_id) return false;
  return resolvePoLineMrp(line) > 0;
}

/** Offer unit price from MRP and trade markdown percent (negative % = above MRP). */
export function computeOfferUnitFromMrpMarkdown(
  mrp: number,
  markdownPct: number,
  decimalPlaces = 2
): string {
  if (mrp <= 0) return "0";
  const offer = mrp * (1 - markdownPct / 100);
  return Math.max(offer, 0).toFixed(decimalPlaces);
}

/** Implied trade markdown % when the user edits offer unit price directly. */
export function computeImpliedMrpMarkdownPct(mrp: number, unitPrice: number): string {
  if (mrp <= 0) return "0";
  const unit = Math.max(unitPrice, 0);
  if (unit <= 0) return formatDocumentDecimal(100, 2);
  const pct = ((mrp - unit) / mrp) * 100;
  return formatDocumentDecimal(pct, 2);
}

export function resolvePoLineMrpMarkdownPercentage(line: PoDraftLine): string {
  const mrp = resolvePoLineMrp(line);
  const unit = parseNonNegativeAmount(line.unit_price_contractual);
  if (mrp <= 0) return "0";

  if (unit <= 0) {
    return computeImpliedMrpMarkdownPct(mrp, unit);
  }

  const explicit = line.mrp_markdown_percentage?.trim();
  if (explicit) {
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
  const markdownPct = parseSignedAmount(normalizeDocumentDecimalInput(markdownPctRaw, 2));
  const formattedMarkdown = formatDocumentDecimal(markdownPct, 2);
  const mrp = resolvePoLineMrp(line);
  const currentUnit = parseNonNegativeAmount(line.unit_price_contractual);

  // Tab-through on unchanged implied markdown must not round-trip unit price via 2-decimal %.
  if (mrp > 0 && currentUnit > 0) {
    const impliedMarkdown = computeImpliedMrpMarkdownPct(mrp, currentUnit);
    if (formattedMarkdown === impliedMarkdown) {
      return {
        mrp_markdown_percentage: formattedMarkdown,
        unit_price_contractual: line.unit_price_contractual,
      };
    }
  }

  return {
    mrp_markdown_percentage: formattedMarkdown,
    unit_price_contractual:
      mrp > 0
        ? computeOfferUnitFromMrpMarkdown(mrp, markdownPct, decimalPlaces)
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
        ? parsed != null
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
  const parsed = parseSignedDraftDecimal(markdownPctRaw);

  const offer =
    mrp > 0 && parsed != null
      ? Math.max(mrp * (1 - parsed / 100), 0).toFixed(decimalPlaces)
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

/** Value shown in the PO MRP input — raw override while editing, else catalog default. */
export function resolvePoLineMrpReferenceDisplay(
  line: Pick<PoDraftLine, "mrp_reference" | "catalog_context">,
  decimalPlaces = 2
): string {
  if (line.mrp_reference != null) return line.mrp_reference;
  const catalogMrp = resolvePoLineMrpFromCatalog(line);
  if (catalogMrp > 0) return formatPoLineMrpReference(catalogMrp, decimalPlaces);
  return "";
}

/** True when the line uses a PO MRP override different from catalog. */
export function hasPoLineMrpOverride(
  line: Pick<PoDraftLine, "mrp_reference" | "catalog_context">
): boolean {
  const explicit = line.mrp_reference?.trim();
  if (!explicit) return false;
  const catalogMrp = resolvePoLineMrpFromCatalog(line);
  if (catalogMrp <= 0) return true;
  const parsed = Number(explicit.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return true;
  return Math.abs(parsed - catalogMrp) > 0.0001;
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
