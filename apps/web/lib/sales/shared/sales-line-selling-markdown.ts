import {
  formatDocumentDecimal,
  normalizeDocumentDecimalInput,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import {
  resolvePoLineMrpTaxContext,
  type PoLineMrpTaxContext,
} from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import { resolveSalesLinePickerOfferUnitPrice } from "@/lib/sales/shared/sales-line-offer-price";
import { scaleSalesCatalogBaseUnitPriceToLineUom } from "@/lib/sales/shared/sales-line-uom-options";
import type { SalesCommerceLineBase } from "@/lib/sales/shared/sales-line-entry";

function roundMoney(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

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

function toExTaxBasis(amount: number, isInclusive: boolean, taxRate: number): number {
  if (amount <= 0 || !isInclusive || taxRate <= 0) return amount;
  return roundMoney(amount / (1 + taxRate / 100));
}

function fromExTaxBasis(exTaxAmount: number, isInclusive: boolean, taxRate: number): number {
  if (exTaxAmount <= 0 || !isInclusive || taxRate <= 0) return exTaxAmount;
  return roundMoney(exTaxAmount * (1 + taxRate / 100));
}

function normalizeCatalogOfferPair(
  catalogSelling: number,
  offerUnit: number,
  context: PoLineMrpTaxContext
): { compareCatalog: number; compareOffer: number } {
  if (context.taxRate <= 0) {
    return { compareCatalog: catalogSelling, compareOffer: offerUnit };
  }
  return {
    compareCatalog: toExTaxBasis(
      catalogSelling,
      context.mrpPriceIsTaxInclusive,
      context.taxRate
    ),
    compareOffer: toExTaxBasis(offerUnit, context.pricesTaxInclusive, context.taxRate),
  };
}

export function resolveSalesLineCatalogSellingPrice(
  line: Pick<SalesCommerceLineBase, "catalog_context">
): number {
  return parsePositiveAmount(line.catalog_context?.selling_price ?? null);
}

function computeImpliedSellingMarkdownPct(
  catalogSelling: number,
  offerUnit: number,
  context: PoLineMrpTaxContext
): string {
  const { compareCatalog, compareOffer } = normalizeCatalogOfferPair(
    catalogSelling,
    offerUnit,
    context
  );
  if (compareCatalog <= 0) return "0";
  const pct = ((compareCatalog - compareOffer) / compareCatalog) * 100;
  return formatDocumentDecimal(pct, 2);
}

function computeOfferUnitFromSellingMarkdown(
  catalogSelling: number,
  markdownPct: number,
  decimalPlaces: number,
  context: PoLineMrpTaxContext
): string {
  const { compareCatalog } = normalizeCatalogOfferPair(catalogSelling, catalogSelling, context);
  const compareOffer = compareCatalog * (1 - markdownPct / 100);
  const offerInDocBasis =
    context.pricesTaxInclusive && context.taxRate > 0
      ? roundMoney(compareOffer * (1 + context.taxRate / 100))
      : compareOffer;
  return formatDocumentDecimal(Math.max(0, offerInDocBasis), decimalPlaces);
}

export function resolveSalesLineSellingMarkdownPercentage(
  line: SalesCommerceLineBase,
  pricesTaxInclusive = false
): string {
  const catalogSelling = resolveSalesLineCatalogSellingPrice(line);
  const offerUnit = parseNonNegativeAmount(line.unit_price_selling);
  const context = resolvePoLineMrpTaxContext(line, pricesTaxInclusive);
  if (catalogSelling <= 0) return "0";
  if (offerUnit <= 0) {
    return computeImpliedSellingMarkdownPct(catalogSelling, offerUnit, context);
  }
  const explicit = line.selling_markdown_percentage?.trim();
  if (explicit) return explicit;
  return computeImpliedSellingMarkdownPct(catalogSelling, offerUnit, context);
}

export function syncSalesLineSellingMarkdownFromOfferPrice(
  line: SalesCommerceLineBase,
  pricesTaxInclusive = false
): Pick<SalesCommerceLineBase, "selling_markdown_percentage"> | null {
  const catalogSelling = resolveSalesLineCatalogSellingPrice(line);
  if (catalogSelling <= 0) return null;
  const offerUnit = parseNonNegativeAmount(line.unit_price_selling);
  const context = resolvePoLineMrpTaxContext(line, pricesTaxInclusive);
  return {
    selling_markdown_percentage: computeImpliedSellingMarkdownPct(
      catalogSelling,
      offerUnit,
      context
    ),
  };
}

export function patchSalesLineSellingMarkdownPercentage(
  line: SalesCommerceLineBase,
  markdownPctRaw: string,
  priceColumn: DocumentColumnPref,
  pricesTaxInclusive = false
): Pick<SalesCommerceLineBase, "selling_markdown_percentage" | "unit_price_selling"> {
  const decimalPlaces = resolveColumnDecimalPlaces(priceColumn);
  const markdownPct = parseSignedAmount(normalizeDocumentDecimalInput(markdownPctRaw, 2));
  const formattedMarkdown = formatDocumentDecimal(markdownPct, 2);
  const catalogSelling = resolveSalesLineCatalogSellingPrice(line);
  const currentOffer = parseNonNegativeAmount(line.unit_price_selling);
  const context = resolvePoLineMrpTaxContext(line, pricesTaxInclusive);

  if (catalogSelling > 0 && currentOffer > 0) {
    const impliedMarkdown = computeImpliedSellingMarkdownPct(
      catalogSelling,
      currentOffer,
      context
    );
    if (formattedMarkdown === impliedMarkdown) {
      return {
        selling_markdown_percentage: formattedMarkdown,
        unit_price_selling: line.unit_price_selling,
      };
    }
  }

  return {
    selling_markdown_percentage: formattedMarkdown,
    unit_price_selling:
      catalogSelling > 0
        ? computeOfferUnitFromSellingMarkdown(
            catalogSelling,
            markdownPct,
            decimalPlaces,
            context
          )
        : line.unit_price_selling,
  };
}

function parseDraftDecimal(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function patchSalesLineOfferUnitPriceDraft(
  line: SalesCommerceLineBase,
  unitPriceRaw: string,
  pricesTaxInclusive = false
): Pick<SalesCommerceLineBase, "selling_markdown_percentage" | "unit_price_selling"> {
  const catalogSelling = resolveSalesLineCatalogSellingPrice(line);
  const parsed = parseDraftDecimal(unitPriceRaw);
  const context = resolvePoLineMrpTaxContext(line, pricesTaxInclusive);

  return {
    unit_price_selling: unitPriceRaw,
    selling_markdown_percentage:
      catalogSelling > 0 && parsed != null
        ? computeImpliedSellingMarkdownPct(catalogSelling, parsed, context)
        : line.selling_markdown_percentage ?? "0",
  };
}

export function patchSalesLineOfferUnitPrice(
  line: SalesCommerceLineBase,
  unitPriceRaw: string,
  priceColumn: DocumentColumnPref,
  pricesTaxInclusive = false
): Pick<SalesCommerceLineBase, "selling_markdown_percentage" | "unit_price_selling"> {
  const decimalPlaces = resolveColumnDecimalPlaces(priceColumn);
  const normalized = normalizeDocumentDecimalInput(unitPriceRaw, decimalPlaces);
  const draft = patchSalesLineOfferUnitPriceDraft(line, normalized, pricesTaxInclusive);
  return {
    unit_price_selling: normalized,
    selling_markdown_percentage: draft.selling_markdown_percentage,
  };
}

export function formatSalesLineCatalogSellingReference(
  catalogSelling: number,
  decimalPlaces = 2
): string {
  return formatDocumentDecimal(catalogSelling, decimalPlaces);
}

/** Catalog selling rate in the same tax basis as the document unit rate field. */
export function resolveSalesLineCatalogSellingDisplayAmount(
  line: Pick<SalesCommerceLineBase, "catalog_context">,
  pricesTaxInclusive = false
): number {
  const catalogSelling = resolveSalesLineCatalogSellingPrice(line);
  if (catalogSelling <= 0) return 0;

  const context = resolvePoLineMrpTaxContext(line, pricesTaxInclusive);
  if (context.taxRate <= 0) return catalogSelling;

  const exTax = toExTaxBasis(
    catalogSelling,
    context.mrpPriceIsTaxInclusive,
    context.taxRate
  );
  return pricesTaxInclusive
    ? fromExTaxBasis(exTax, true, context.taxRate)
    : exTax;
}

export function formatSalesLineCatalogSellingReferenceForDocument(
  line: Pick<SalesCommerceLineBase, "catalog_context">,
  pricesTaxInclusive: boolean,
  decimalPlaces = 2
): string {
  return formatDocumentDecimal(
    resolveSalesLineCatalogSellingDisplayAmount(line, pricesTaxInclusive),
    decimalPlaces
  );
}

export function shouldShowSalesLineCatalogSellingSubline(
  line: Pick<SalesCommerceLineBase, "variant_id" | "catalog_context">
): boolean {
  return Boolean(line.variant_id) && resolveSalesLineCatalogSellingPrice(line) > 0;
}

export function applySellingCatalogToLine<T extends SalesCommerceLineBase>(
  line: T,
  catalogContext: PoLineCatalogContext,
  pricesTaxInclusive: boolean
): T {
  const catalogSelling = catalogContext.selling_price?.trim();
  const offerFromCatalog = catalogSelling
    ? resolveSalesLinePickerOfferUnitPrice(catalogSelling)
    : null;
  const scaledOfferFromCatalog = offerFromCatalog
    ? scaleSalesCatalogBaseUnitPriceToLineUom(offerFromCatalog, {
        ...line,
        catalog_context: catalogContext,
      })
    : null;
  const shouldPrefillOffer =
    Boolean(scaledOfferFromCatalog) &&
    (!line.unit_price_selling.trim() || line.unit_price_selling === "0");

  const nextLine = {
    ...line,
    catalog_context: catalogContext,
    ...(shouldPrefillOffer && scaledOfferFromCatalog
      ? { unit_price_selling: scaledOfferFromCatalog }
      : {}),
  } as T;

  const sync = syncSalesLineSellingMarkdownFromOfferPrice(nextLine, pricesTaxInclusive);
  return sync ? ({ ...nextLine, ...sync } as T) : nextLine;
}
