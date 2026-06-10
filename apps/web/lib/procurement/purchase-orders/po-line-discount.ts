import {
  formatDocumentDecimal,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import {
  getPoLayoutColumnPref,
  normalizePoLayoutTemplate,
  type DocumentLayoutDefaults,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";
import {
  resolveLineDiscount,
  type PoLineTotalsInput,
} from "@/lib/procurement/purchase-orders/totals";

export type PoLineDiscountType = "percent" | "amount";

export type PoLineDiscountFields = {
  discount_percentage: string;
  discount_amount: string;
  discount_type?: PoLineDiscountType;
};

function parsePositiveAmount(value: string | undefined): number {
  const parsed = Number((value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Infer mode from persisted line values (saved PO has at most one non-zero discount field). */
export function inferPoLineDiscountTypeFromSaved(
  line: Pick<PurchaseOrderLineRow, "discount_percentage" | "discount_amount">
): PoLineDiscountType {
  if (parsePositiveAmount(line.discount_amount) > 0) return "amount";
  return "percent";
}

/** Active discount entry mode — uses explicit draft type when set. */
export function resolvePoLineDiscountType(line: PoLineDiscountFields): PoLineDiscountType {
  if (line.discount_type === "percent" || line.discount_type === "amount") {
    return line.discount_type;
  }
  if (parsePositiveAmount(line.discount_amount) > 0) return "amount";
  return "percent";
}

export function resolvePoLineDiscountInputValue(line: PoLineDiscountFields): string {
  return resolvePoLineDiscountType(line) === "amount"
    ? line.discount_amount
    : line.discount_percentage;
}

/** True when the Discount line field is visible as its own column. */
export function isPoDiscountPctLineFieldVisible(
  layout: DocumentLayoutDefaults
): boolean {
  return (
    getPoLayoutColumnPref(normalizePoLayoutTemplate(layout), "discount_pct")
      ?.defaultVisible === true
  );
}

/** Embed computed disc amount under Discount when the standalone Disc amount column is off. */
export function shouldShowPoDiscountAmountUnderPctColumn(
  layout: DocumentLayoutDefaults
): boolean {
  const normalized = normalizePoLayoutTemplate(layout);
  return (
    isPoDiscountPctLineFieldVisible(normalized) &&
    getPoLayoutColumnPref(normalized, "discount_amount")?.defaultVisible !== true
  );
}

/** Always show % | Amt under the discount entry column (independent of disc amount column visibility). */
export function shouldShowPoDiscountTypeUnderPctColumn(): boolean {
  return true;
}

export function resolvePoLineDiscountDecimalPlaces(
  type: PoLineDiscountType,
  percentColumn: DocumentColumnPref,
  amountColumn: DocumentColumnPref | null | undefined
): number {
  if (type === "amount") {
    return resolveColumnDecimalPlaces(amountColumn ?? percentColumn);
  }
  return resolveColumnDecimalPlaces(percentColumn);
}

function formatDiscountNumber(value: string, decimalPlaces: number): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  return formatDocumentDecimal(parsed, decimalPlaces);
}

/** Computed line discount in document currency (read-only disc amount column). */
export function formatPoLineComputedDiscountAmount(
  line: PoLineTotalsInput & PoLineDiscountFields,
  column: DocumentColumnPref
): string {
  const discount = resolveLineDiscount(line);
  if (discount <= 0) return formatDocumentDecimal(0, resolveColumnDecimalPlaces(column));
  return formatDocumentDecimal(discount, resolveColumnDecimalPlaces(column));
}

/** Peek display for discount entry column (% suffix in percent mode). */
export function formatPoPeekDiscountEntryDisplay(
  line: Pick<PurchaseOrderLineRow, "discount_percentage" | "discount_amount">,
  percentColumn: DocumentColumnPref
): string | null {
  const type = inferPoLineDiscountTypeFromSaved(line);
  if (type === "amount") {
    return formatDiscountNumber(
      line.discount_amount,
      resolveColumnDecimalPlaces(percentColumn)
    );
  }
  const formatted = formatDiscountNumber(
    line.discount_percentage,
    resolveColumnDecimalPlaces(percentColumn)
  );
  return formatted ? `${formatted}%` : null;
}

/** Peek display for read-only computed discount amount column. */
export function formatPoPeekComputedDiscountAmountDisplay(
  line: Pick<
    PurchaseOrderLineRow,
    "quantity_ordered" | "unit_price_contractual" | "discount_percentage" | "discount_amount"
  >,
  column: DocumentColumnPref
): string | null {
  const type = inferPoLineDiscountTypeFromSaved(line);
  const discount = resolveLineDiscount({
    quantity_ordered: line.quantity_ordered,
    unit_price_contractual: line.unit_price_contractual,
    discount_percentage: line.discount_percentage,
    discount_amount: line.discount_amount,
    discount_type: type,
  });
  if (discount <= 0) return null;
  return formatDocumentDecimal(discount, resolveColumnDecimalPlaces(column));
}

export function patchPoLineDiscountPercentInput(
  _line: PoLineDiscountFields,
  raw: string
): Pick<PoDraftLine, "discount_type" | "discount_percentage" | "discount_amount"> {
  return {
    discount_type: "percent",
    discount_percentage: raw,
    discount_amount: "0",
  };
}

export function patchPoLineDiscountAmountInput(
  _line: PoLineDiscountFields,
  raw: string
): Pick<PoDraftLine, "discount_type" | "discount_percentage" | "discount_amount"> {
  return {
    discount_type: "amount",
    discount_percentage: "0",
    discount_amount: raw,
  };
}

export function patchPoLineDiscountType(
  line: PoLineDiscountFields,
  type: PoLineDiscountType
): Pick<PoDraftLine, "discount_type" | "discount_percentage" | "discount_amount"> {
  if (type === "amount") {
    return {
      discount_type: "amount",
      discount_percentage: "0",
      discount_amount: line.discount_amount,
    };
  }
  return {
    discount_type: "percent",
    discount_percentage: line.discount_percentage,
    discount_amount: "0",
  };
}

/** Normalize line discount fields for save RPC (single active value). */
export function normalizePoLineDiscountForSave(
  line: PoLineDiscountFields
): { discount_percentage: string; discount_amount: string } {
  const type = resolvePoLineDiscountType(line);
  if (type === "amount") {
    return {
      discount_percentage: "0",
      discount_amount: line.discount_amount || "0",
    };
  }
  return {
    discount_percentage: line.discount_percentage || "0",
    discount_amount: "0",
  };
}
