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
};

export function mapSalesCommerceLineToRpcPayload(
  line: SalesCommerceRpcLineSource,
  quantity: number,
  options?: { source_order_line_id?: string | null }
): SalesCommerceRpcLinePayload {
  const uomCode = resolveSalesDraftLineUomCodeForSave(line);
  return {
    variant_id: line.variant_id,
    quantity,
    unit_price: Number(line.unit_price_selling),
    discount_percentage: Number(line.discount_percentage),
    discount_amount: Number(line.discount_amount),
    ...(uomCode ? { uom_code: uomCode } : {}),
    ...(options?.source_order_line_id ? { source_order_line_id: options.source_order_line_id } : {}),
  };
}
