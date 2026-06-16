import type { SalesApprovalRule } from "@/lib/sales/sales-approval-rules";
import type { SalesQuoteLineRow } from "@/lib/sales/quotes/types";
import type { SalesOrderLineRow } from "@/lib/sales/orders/types";
import type { SalesInvoiceLineRow } from "@/lib/sales/invoices/types";

export type SalesApprovalRuleEvaluationLine = {
  quantity: number;
  unit_price_selling: number;
  discount_percentage: number;
  list_price?: number | null;
};

/** Client-side mirror of `private.evaluate_sales_approval_rules` (best effort). */
export function salesApprovalRulesRequireApproval(
  rules: SalesApprovalRule[] | undefined,
  lines: SalesApprovalRuleEvaluationLine[] | undefined
): boolean {
  if (!rules?.length || !lines?.length) return false;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.type === "LINE_QTY_ABOVE" && rule.threshold != null) {
      if (lines.some((line) => line.quantity > rule.threshold!)) {
        return true;
      }
      continue;
    }

    if (rule.type === "LINE_DISCOUNT_ABOVE" && rule.threshold != null) {
      if (lines.some((line) => line.discount_percentage > rule.threshold!)) {
        return true;
      }
      continue;
    }

    if (rule.type === "LINE_PRICE_BELOW_LIST") {
      const tolerance = rule.tolerance_percent ?? 0;
      for (const line of lines) {
        if (line.list_price == null || !Number.isFinite(line.list_price)) continue;
        const minimumAllowedPrice = line.list_price * (1 - tolerance / 100);
        if (line.unit_price_selling < minimumAllowedPrice) {
          return true;
        }
      }
    }
  }

  return false;
}

export function mapQuoteLinesForApprovalRules(
  lines: SalesQuoteLineRow[] | undefined
): SalesApprovalRuleEvaluationLine[] | undefined {
  if (!lines?.length) return undefined;

  return lines.map((line) => ({
    quantity: Number(line.quantity_quoted),
    unit_price_selling: Number(line.unit_price_selling),
    discount_percentage: Number(line.discount_percentage),
  }));
}

export function mapSalesOrderLinesForApprovalRules(
  lines: SalesOrderLineRow[] | undefined
): SalesApprovalRuleEvaluationLine[] | undefined {
  if (!lines?.length) return undefined;

  return lines.map((line) => ({
    quantity: Number(line.quantity_ordered),
    unit_price_selling: Number(line.unit_price_selling),
    discount_percentage: Number(line.discount_percentage),
  }));
}

export function mapInvoiceLinesForApprovalRules(
  lines: SalesInvoiceLineRow[] | undefined
): SalesApprovalRuleEvaluationLine[] | undefined {
  if (!lines?.length) return undefined;

  return lines.map((line) => ({
    quantity: Number(line.quantity_invoiced),
    unit_price_selling: Number(line.unit_price_selling),
    discount_percentage: Number(line.discount_percentage),
  }));
}
