import { buildCatalogFieldId } from "@/lib/documents/catalog-field-ids";
import {
  applyGstRegisteredDocumentLayoutOverrides,
  HSN_CATALOG_FIELD_ID,
  patchCatalogLineHsnSacCode,
} from "@/lib/documents/gst-document-layout-compliance";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import { createPoCatalogFieldPref } from "@/lib/documents/purchase-order-layout";
import { isGstinFormat } from "@/lib/entities/gstin";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { isPromotionalPoLine } from "@/lib/procurement/purchase-orders/po-promo";
import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import { isGstImportSupplyNature } from "@/lib/tax/gst-supply-context";

export const PO_HSN_CATALOG_FIELD_ID = HSN_CATALOG_FIELD_ID;

/** Indian org with a valid GSTIN on file. */
export function isOrganizationGstRegistered(
  billTo: Pick<OrganizationBillToSnapshot, "country_code" | "tax_identifier"> | null | undefined
): boolean {
  if (!billTo) return false;
  const country = billTo.country_code?.trim().toUpperCase();
  if (country !== "IN") return false;
  const taxId = billTo.tax_identifier?.trim();
  return Boolean(taxId && isGstinFormat(taxId));
}

/** Force HSN/SAC visible under item lines when the org is GST registered. */
export function applyGstRegisteredPoLayoutOverrides(
  layout: DocumentLayoutTemplate,
  gstRegistered: boolean
): DocumentLayoutTemplate {
  return applyGstRegisteredDocumentLayoutOverrides(
    layout,
    gstRegistered,
    createPoCatalogFieldPref
  );
}

export function patchPoLineHsnSacCode(
  line: PoDraftLine,
  hsnSacCode: string
): Partial<PoDraftLine> {
  return patchCatalogLineHsnSacCode(line, hsnSacCode);
}

function lineItemLabel(line: PoDraftLine): string {
  return line.item_name?.trim() || line.variant_sku?.trim() || "a paid line";
}

/** Paid PO line has an explicit GST tax rule or a positive catalog rate. */
export function hasPoLineGstTaxConfigured(line: PoDraftLine): boolean {
  const ctx = line.catalog_context;
  if (!ctx) return false;
  if (ctx.tax_code_id?.trim()) return true;
  if (ctx.tax_is_variable) return false;
  return Number.isFinite(ctx.tax_rate) && ctx.tax_rate > 0;
}

function shouldValidatePoLineGstTax(supplyNature?: PoTaxSupplyNature): boolean {
  if (!supplyNature) return true;
  if (isGstImportSupplyNature(supplyNature)) return false;
  if (supplyNature === "EXPORT") return false;
  return true;
}

export function validatePoGstComplianceLines(
  lines: PoDraftLine[],
  gstRegistered: boolean,
  options?: { supplyNature?: PoTaxSupplyNature }
): string | null {
  if (!gstRegistered) return null;

  const validateTax = shouldValidatePoLineGstTax(options?.supplyNature);

  for (const line of lines) {
    if (!line.variant_id || isPromotionalPoLine(line)) continue;

    const label = lineItemLabel(line);
    const hsn = line.catalog_context?.hsn_sac_code?.trim();
    if (!hsn) {
      return `HSN/SAC is required for ${label} on GST-registered purchase orders.`;
    }

    if (validateTax && !hasPoLineGstTaxConfigured(line)) {
      return `GST tax % is required for ${label}. Select a tax rule on the line.`;
    }
  }

  return null;
}
