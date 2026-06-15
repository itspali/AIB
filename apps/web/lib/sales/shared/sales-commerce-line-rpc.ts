import type { SalesCommerceLineBase } from "@/lib/sales/shared/sales-line-entry";
import { resolveSalesDraftLineUomCodeForSave } from "@/lib/sales/shared/sales-line-uom-options";

export type SalesCommerceRpcLineSource = Pick<
  SalesCommerceLineBase,
  | "variant_id"
  | "unit_price_selling"
  | "discount_percentage"
  | "discount_amount"
  | "uom_code"
  | "catalog_context"
  | "base_unit_of_measure"
> & {
  variant_id: string;
};

export type SalesCommerceRpcLinePayload = {
  variant_id: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  uom_code?: string;
  source_order_line_id?: string;
  source_quotation_line_id?: string;
};

function trimUomCode(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function mapSalesCommerceLineToRpcPayload(
  line: SalesCommerceRpcLineSource,
  quantity: number,
  options?: { source_order_line_id?: string | null; source_quotation_line_id?: string | null }
): SalesCommerceRpcLinePayload {
  const resolvedUom = resolveSalesDraftLineUomCodeForSave(line);
  const explicitUom = trimUomCode(line.uom_code);
  const baseUom =
    trimUomCode(line.catalog_context?.base_unit_of_measure) ??
    trimUomCode(line.base_unit_of_measure);
  const uomCode =
    resolvedUom ?? (explicitUom && explicitUom !== baseUom ? explicitUom : undefined);
  return {
    variant_id: line.variant_id,
    quantity,
    unit_price: Number(line.unit_price_selling),
    discount_percentage: Number(line.discount_percentage),
    discount_amount: Number(line.discount_amount),
    ...(uomCode ? { uom_code: uomCode } : {}),
    ...(options?.source_order_line_id ? { source_order_line_id: options.source_order_line_id } : {}),
    ...(options?.source_quotation_line_id
      ? { source_quotation_line_id: options.source_quotation_line_id }
      : {}),
  };
}
