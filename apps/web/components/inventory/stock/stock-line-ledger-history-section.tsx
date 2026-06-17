"use client";

import {
  DocumentLinePeekTable,
  DocumentLinePeekValueCell,
} from "@/components/documents/document-line-peek-table";
import { formatDateTime } from "@/lib/dashboard/format";
import { inventoryTransactionTypeLabel } from "@/lib/inventory/stock/labels";
import type { InventoryLedgerHistoryRow } from "@/lib/inventory/stock/ledger-history";
import type { StockAdjustmentLineRow } from "@/lib/inventory/stock/types";
import { cn } from "@/lib/utils";

type Props = {
  lines: StockAdjustmentLineRow[];
  entriesByVariantId: Record<string, InventoryLedgerHistoryRow[]>;
  highlightReference?: string;
  loading?: boolean;
};

function uniqueLinesByVariant(lines: StockAdjustmentLineRow[]): StockAdjustmentLineRow[] {
  const seen = new Set<string>();
  const result: StockAdjustmentLineRow[] = [];
  for (const line of lines) {
    if (!line.variant_id || seen.has(line.variant_id)) continue;
    seen.add(line.variant_id);
    result.push(line);
  }
  return result;
}

function formatLedgerQuantity(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  if (parsed > 0) return `+${value}`;
  return value;
}

export function StockLineLedgerHistorySection({
  lines,
  entriesByVariantId,
  highlightReference,
  loading = false,
}: Props) {
  const lineItems = uniqueLinesByVariant(lines);

  if (lineItems.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Stock history
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Recent inventory ledger movements at this location, per line item.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading stock history…</p>
      ) : (
        lineItems.map((line) => {
          const entries = entriesByVariantId[line.variant_id] ?? [];

          return (
            <div key={line.variant_id} className="space-y-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{line.item_name}</p>
                <p className="font-mono text-xs text-muted-foreground">{line.variant_sku}</p>
              </div>

              {entries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  No ledger transactions for this item at this location.
                </div>
              ) : (
                <DocumentLinePeekTable
                  lines={entries}
                  showLineNumbers={false}
                  minTableWidth="min-w-[36rem]"
                  getRowKey={(entry) => entry.id}
                  columns={[
                    { id: "posted", label: "Posted", align: "left", widthClass: "min-w-[10.5rem]" },
                    { id: "type", label: "Type", align: "left", widthClass: "min-w-[8rem]" },
                    { id: "reference", label: "Reference", align: "left", widthClass: "min-w-[8rem]" },
                    { id: "quantity", label: "Qty", align: "right", widthClass: "w-[4.5rem]" },
                    { id: "balance", label: "Balance", align: "right", widthClass: "w-[5rem]" },
                    { id: "cost", label: "Unit cost", align: "right", widthClass: "w-[5.5rem]" },
                  ]}
                  renderCell={(column, entry) => {
                    if (column.id === "posted") {
                      return (
                        <span className="text-muted-foreground tabular-nums">
                          {formatDateTime(entry.created_at)}
                        </span>
                      );
                    }
                    if (column.id === "type") {
                      return (
                        <span className="text-muted-foreground">
                          {inventoryTransactionTypeLabel(entry.transaction_type)}
                        </span>
                      );
                    }
                    if (column.id === "reference") {
                      const isCurrent =
                        highlightReference != null &&
                        entry.reference_document === highlightReference;
                      return (
                        <span
                          className={cn(
                            "font-mono text-xs text-muted-foreground",
                            isCurrent && "font-semibold text-foreground"
                          )}
                        >
                          {entry.reference_document || "—"}
                        </span>
                      );
                    }
                    if (column.id === "quantity") {
                      return (
                        <DocumentLinePeekValueCell value={formatLedgerQuantity(entry.quantity)} />
                      );
                    }
                    if (column.id === "balance") {
                      return <DocumentLinePeekValueCell value={entry.balance_after} />;
                    }
                    return <DocumentLinePeekValueCell value={entry.cost_at_transaction} />;
                  }}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
