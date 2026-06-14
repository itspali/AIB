"use client";

import { Badge } from "@/components/ui/badge";
import {
  DocumentLinePeekItemCell,
  DocumentLinePeekTable,
  DocumentLinePeekValueCell,
} from "@/components/documents/document-line-peek-table";
import { formatDate } from "@/lib/dashboard/format";
import { salesQuoteStatusLabel } from "@/lib/sales/quotes/labels";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";

type Props = {
  quote: SalesQuoteRow;
};

export function QuotePeekView({ quote }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Quote number</p>
          <p className="font-mono text-sm font-medium">{quote.quotation_number}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <Badge variant="administrative" className="mt-0.5 text-xs font-normal">
            {salesQuoteStatusLabel(quote.commercial_status)}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Customer</p>
          <p className="text-sm font-medium">{quote.customer_name}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Valid until</p>
          <p className="text-sm">{formatDate(quote.valid_until)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Net amount</p>
          <p className="text-sm font-medium">{quote.total_net_amount}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Origin</p>
          <p className="text-sm">{quote.origin_location_name || "—"}</p>
        </div>
      </div>

      {quote.lines?.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lines
          </p>
          <DocumentLinePeekTable
            lines={quote.lines}
            getRowKey={(line) => line.id}
            columns={[
              { id: "item", label: "Item", align: "left" },
              { id: "quantity", label: "Qty", align: "right", widthClass: "w-[4.5rem]" },
              { id: "unit_price", label: "Unit price", align: "right", widthClass: "w-[4.5rem]" },
              { id: "line_total", label: "Line total", align: "right", widthClass: "w-[4.5rem]" },
            ]}
            renderCell={(column, line) => {
              if (column.id === "item") {
                return (
                  <DocumentLinePeekItemCell
                    itemName={line.item_name ?? "Item"}
                    variantSku={line.variant_sku ?? ""}
                  />
                );
              }
              if (column.id === "quantity") {
                return <DocumentLinePeekValueCell value={line.quantity_quoted} />;
              }
              if (column.id === "unit_price") {
                return <DocumentLinePeekValueCell value={line.unit_price_selling} />;
              }
              return <DocumentLinePeekValueCell value={line.line_total_gross} />;
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
