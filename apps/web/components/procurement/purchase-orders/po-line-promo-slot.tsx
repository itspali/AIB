"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  onPatch: (patch: Partial<PoDraftLine>) => void;
};

export function PoLinePromoSlot({
  line,
  lines,
  defaultCategory,
  disabled,
  onPatch,
}: Props) {
  if (!isPromotionalPoLine(line) || !line.variant_id) return null;

  const paidLines = paidPoLinesForPromoLink(lines, line.key);

  return (
    <div className="mt-2 space-y-2 rounded-md border border-dashed border-border/80 bg-muted/20 p-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Free goods
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Linked paid line</Label>
          <Select
            value={line.linked_parent_line_key ?? "none"}
            disabled={disabled || paidLines.length === 0}
            onValueChange={(value) =>
              onPatch({
                linked_parent_line_key: value === "none" ? null : value,
                promotional_category: line.promotional_category || defaultCategory,
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select paid line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select paid line</SelectItem>
              {paidLines.map((paidLine) => (
                <SelectItem key={paidLine.key} value={paidLine.key}>
                  {paidLine.item_name || paidLine.variant_sku} · qty {paidLine.quantity_ordered}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Promotional category</Label>
          <Input
            className="h-8 text-xs"
            value={line.promotional_category ?? defaultCategory}
            disabled={disabled}
            onChange={(event) => onPatch({ promotional_category: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
