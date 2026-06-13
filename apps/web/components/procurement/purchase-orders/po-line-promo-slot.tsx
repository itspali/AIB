"use client";

import { Input } from "@/components/ui/input";
import {
  PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS,
  PO_LINE_SUBLINE_SELECT_CLASS,
  PO_LINE_SUBLINE_TEXT_CLASS,
  PoLineSublineRow,
  PoLineSublineZone,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { cn } from "@/lib/utils";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import {
  isPromotionalPoLine,
  paidPoLinesForPromoLink,
} from "@/lib/procurement/purchase-orders/po-promo";

type Props = {
  line: PoDraftLine;
  lines: PoDraftLine[];
  defaultCategory: string;
  disabled?: boolean;
  align?: DocumentColumnPref["align"];
  onPatch: (patch: Partial<PoDraftLine>) => void;
};

function resolvePaidLineLabel(line: PoDraftLine): string {
  const name = line.item_name?.trim() || line.variant_sku?.trim() || "Item";
  const qty = line.quantity_ordered?.trim();
  return qty ? `${name} · ${qty}` : name;
}

/** Compact free-goods controls stacked under unit price (narrow column). */
export function PoLinePromoSlot({
  line,
  lines,
  defaultCategory,
  disabled,
  align = "right",
  onPatch,
}: Props) {
  if (!isPromotionalPoLine(line) || !line.variant_id) return null;

  const paidLines = paidPoLinesForPromoLink(lines, line.key);
  const linkedParentKey = line.linked_parent_line_key ?? "";
  const categoryPlaceholder = defaultCategory.replace(/_/g, " ");

  return (
    <PoLineSublineZone align={align} className="max-w-full overflow-hidden">
      <PoLineSublineRow align={align}>
        <select
          id={`po-promo-parent-${line.key}`}
          value={linkedParentKey || "none"}
          disabled={disabled || paidLines.length === 0}
          aria-label="Linked paid line for free goods"
          title="Link to paid PO line"
          onChange={(event) => {
            const value = event.target.value;
            onPatch({
              linked_parent_line_key: value === "none" ? null : value,
              promotional_category: line.promotional_category || defaultCategory,
            });
          }}
          className={cn(
            "h-4 w-full min-w-0 max-w-full cursor-pointer truncate px-2",
            PO_LINE_SUBLINE_SELECT_CLASS,
            PO_LINE_SUBLINE_TEXT_CLASS,
            align === "right" && "text-right",
            align === "center" && "text-center"
          )}
        >
          <option value="none">Link paid…</option>
          {paidLines.map((paidLine) => (
            <option key={paidLine.key} value={paidLine.key}>
              {resolvePaidLineLabel(paidLine)}
            </option>
          ))}
        </select>
      </PoLineSublineRow>
      <PoLineSublineRow align={align}>
        <Input
          id={`po-promo-category-${line.key}`}
          className={cn(
            PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS,
            "w-full min-w-0 max-w-full px-2",
            PO_LINE_SUBLINE_TEXT_CLASS,
            align === "right" && "text-right",
            align === "center" && "text-center"
          )}
          value={line.promotional_category ?? defaultCategory}
          disabled={disabled}
          aria-label="Promotional category"
          title="Promotional category"
          placeholder={categoryPlaceholder}
          onChange={(event) => onPatch({ promotional_category: event.target.value })}
        />
      </PoLineSublineRow>
    </PoLineSublineZone>
  );
}
