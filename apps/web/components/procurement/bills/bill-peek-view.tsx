"use client";

import { Badge } from "@/components/ui/badge";
import {
  DocumentLinePeekItemCell,
  DocumentLinePeekTable,
  DocumentLinePeekValueCell,
} from "@/components/documents/document-line-peek-table";
import { DocumentPostingSummaryPanel } from "@/components/documents/document-posting-summary-panel";
import { formatDate } from "@/lib/dashboard/format";
import {
  billMatchStatusLabel,
  computePriceVariancePct,
  resolveBillLineMatchSeverity,
} from "@/lib/procurement/bills/three-way-match";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";

type Props = {
  bill: PurchaseBillRow;
  matchingTolerancePct: number;
};

export function BillPeekView({ bill, matchingTolerancePct }: Props) {
  const overall =
    bill.match_status === "PPV_HOLD"
      ? "failure"
      : bill.posting_steps?.some((step) => step.status === "failure")
        ? "failure"
        : "success";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Vendor invoice</p>
          <p className="text-sm font-medium">{bill.invoice_number_vendor}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Match status</p>
          <Badge
            variant={bill.match_status === "PPV_HOLD" ? "action_required" : "administrative"}
            className="mt-0.5 text-xs font-normal"
          >
            {billMatchStatusLabel(bill.match_status)}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Purchase order</p>
          <p className="font-mono text-sm">{bill.purchase_order_number ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Amount due</p>
          <p className="text-sm font-medium">{bill.total_liability_amount}</p>
        </div>
      </div>

      {bill.linked_goods_receipts?.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Linked goods receipts
          </p>
          <ul className="flex flex-wrap gap-2">
            {bill.linked_goods_receipts.map((grn) => (
              <li key={grn.id}>
                <Badge variant="administrative" className="font-mono text-xs font-normal">
                  {grn.voucher_number}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bill.lines?.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lines
          </p>
          <DocumentLinePeekTable
            lines={bill.lines}
            getRowKey={(line) => line.id}
            columns={[
              { id: "item", label: "Item", align: "left" },
              { id: "quantity_billed", label: "Qty", align: "right", widthClass: "w-[4.5rem]" },
              { id: "po_rate", label: "PO rate", align: "right", widthClass: "w-[4.5rem]" },
              { id: "invoice_rate", label: "Invoice", align: "right", widthClass: "w-[4.5rem]" },
              { id: "match", label: "Match", align: "left", widthClass: "w-[5rem]" },
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
              if (column.id === "quantity_billed") {
                return <DocumentLinePeekValueCell value={line.quantity_billed} />;
              }
              if (column.id === "po_rate") {
                return <DocumentLinePeekValueCell value={line.po_unit_price ?? "—"} />;
              }
              if (column.id === "invoice_rate") {
                return <DocumentLinePeekValueCell value={line.unit_price_billed} />;
              }
              const variancePct = computePriceVariancePct(
                Number(line.unit_price_billed),
                Number(line.po_unit_price ?? line.unit_price_billed)
              );
              const severity = resolveBillLineMatchSeverity(variancePct, matchingTolerancePct);
              return (
                <span className="text-xs capitalize text-muted-foreground">
                  {severity === "hold" ? "Hold" : severity === "variance" ? "Variance" : "OK"}
                </span>
              );
            }}
          />
        </div>
      ) : null}

      {bill.posting_steps?.length ? (
        <DocumentPostingSummaryPanel
          steps={bill.posting_steps}
          overall={overall}
          postedAt={bill.posting_at ? formatDate(bill.posting_at) : null}
        />
      ) : null}
    </div>
  );
}
