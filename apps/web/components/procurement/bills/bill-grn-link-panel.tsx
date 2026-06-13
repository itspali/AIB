"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import { cn } from "@/lib/utils";

type Props = {
  grns: GoodsReceiptRow[];
  selectedIds: string[];
  disabled?: boolean;
  className?: string;
  onChange: (selectedIds: string[]) => void;
};

export function BillGrnLinkPanel({
  grns,
  selectedIds,
  disabled = false,
  className,
  onChange,
}: Props) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (grnId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedIds, grnId]);
      return;
    }
    onChange(selectedIds.filter((id) => id !== grnId));
  };

  if (grns.length === 0) {
    return (
      <div className={cn("surface-inset rounded-lg p-4 text-sm text-muted-foreground", className)}>
        No goods receipts found for this purchase order.
      </div>
    );
  }

  return (
    <div className={cn("surface-inset space-y-3 rounded-lg p-4", className)}>
      <div>
        <p className="text-sm font-medium">Linked goods receipts</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Select one or more receipts to include in three-way matching and landed-cost hints.
        </p>
      </div>
      <ul className="space-y-2">
        {grns.map((grn) => {
          const checked = selectedSet.has(grn.id);
          return (
            <li
              key={grn.id}
              className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-2"
            >
              <Checkbox
                id={`bill-grn-${grn.id}`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(value) => toggle(grn.id, value === true)}
              />
              <Label htmlFor={`bill-grn-${grn.id}`} className="min-w-0 flex-1 cursor-pointer">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">{grn.voucher_number}</span>
                  {grn.is_qc_pending ? (
                    <Badge variant="action_required" className="text-xs font-normal">
                      QC pending
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {grn.line_count} line(s) · {grn.destination_location_name}
                </p>
              </Label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
