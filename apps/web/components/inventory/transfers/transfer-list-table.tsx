"use client";

import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";
import { formatDate } from "@/lib/dashboard/format";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: StockTransferRow[];
  selectedId: string | null;
  onSelect: (transferId: string) => void;
};

function statusTone(status: StockTransferRow["current_status"]): string {
  switch (status) {
    case "DRAFT":
      return "bg-muted text-muted-foreground";
    case "DISPATCHED_IN_TRANSIT":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "FULLY_COMPLETED":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "RECEIPT_DISCREPANCY":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "CANCELLED":
      return "bg-muted text-muted-foreground line-through";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function TransferListTable({ rows, selectedId, onSelect }: Props) {
  return (
    <div className="surface-inset h-full min-h-0 overflow-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="p-2.5 font-medium">Document</th>
            <th className="p-2.5 font-medium">From</th>
            <th className="p-2.5 font-medium">To</th>
            <th className="p-2.5 font-medium">Status</th>
            <th className="p-2.5 text-right font-medium">Lines</th>
            <th className="p-2.5 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedId === row.id;
            return (
              <tr
                key={row.id}
                className={cn(
                  "group box-border cursor-pointer border-b border-border transition-colors",
                  selected
                    ? "bg-primary/5 ring-1 ring-inset ring-primary/20"
                    : "hover:bg-muted/30"
                )}
                onClick={() => onSelect(row.id)}
              >
                <td className="p-2.5">
                  <div className="font-mono text-xs font-medium">{row.transfer_number}</div>
                </td>
                <td className="p-2.5">
                  <div className="font-medium">{row.source_location_name}</div>
                  {row.source_location_code ? (
                    <div className="text-xs text-muted-foreground">{row.source_location_code}</div>
                  ) : null}
                </td>
                <td className="p-2.5">
                  <div className="font-medium">{row.destination_location_name}</div>
                  {row.destination_location_code ? (
                    <div className="text-xs text-muted-foreground">
                      {row.destination_location_code}
                    </div>
                  ) : null}
                </td>
                <td className="p-2.5">
                  <span
                    className={cn(
                      "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                      statusTone(row.current_status)
                    )}
                  >
                    {stockTransferStatusLabel(row.current_status)}
                  </span>
                </td>
                <td className="p-2.5 text-right tabular-nums">{row.line_count}</td>
                <td className="p-2.5 text-sm text-muted-foreground">
                  {formatDate(row.dispatched_at ?? row.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
