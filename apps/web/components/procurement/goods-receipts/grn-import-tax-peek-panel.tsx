"use client";

import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import {
  grnHasImportTaxContext,
  sumGrnLineImportTax,
} from "@/lib/procurement/goods-receipts/grn-import-tax";
import { formatDocumentDecimal } from "@/lib/documents/decimal-format";

type Props = {
  receipt: GoodsReceiptRow;
};

function formatMoney(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return formatDocumentDecimal(value, 2);
}

export function GrnImportTaxPeekPanel({ receipt }: Props) {
  if (!grnHasImportTaxContext(receipt)) return null;

  const lineTotals = sumGrnLineImportTax(receipt.lines ?? []);
  const headerIgst = Number(receipt.import_igst_amount ?? 0);
  const headerCustoms = Number(receipt.customs_duty_amount ?? 0);

  return (
    <section className="rounded-lg border border-border bg-muted/20 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Import tax &amp; landed cost
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Import IGST is capitalized to inventory and mirrored as input tax credit. Customs duty is
        included in landed cost and is not recoverable.
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {receipt.bill_of_entry_number ? (
          <div>
            <dt className="text-xs text-muted-foreground">Bill of entry</dt>
            <dd className="font-mono text-sm">{receipt.bill_of_entry_number}</dd>
          </div>
        ) : null}
        {receipt.bill_of_entry_date ? (
          <div>
            <dt className="text-xs text-muted-foreground">BoE date</dt>
            <dd className="text-sm">{receipt.bill_of_entry_date}</dd>
          </div>
        ) : null}
        {receipt.assessable_value ? (
          <div>
            <dt className="text-xs text-muted-foreground">Assessable value</dt>
            <dd className="text-sm font-medium">{formatMoney(receipt.assessable_value)}</dd>
          </div>
        ) : null}
        {receipt.exchange_rate ? (
          <div>
            <dt className="text-xs text-muted-foreground">Exchange rate</dt>
            <dd className="text-sm font-medium">{formatMoney(receipt.exchange_rate)}</dd>
          </div>
        ) : null}
        {(headerCustoms > 0 || lineTotals.customsDuty > 0) && (
          <div>
            <dt className="text-xs text-muted-foreground">Customs duty</dt>
            <dd className="text-sm font-medium">
              {formatMoney(
                headerCustoms > 0 ? receipt.customs_duty_amount : String(lineTotals.customsDuty)
              )}
            </dd>
          </div>
        )}
        {(headerIgst > 0 || lineTotals.importIgst > 0) && (
          <div>
            <dt className="text-xs text-muted-foreground">Import IGST (recoverable)</dt>
            <dd className="text-sm font-medium">
              {formatMoney(
                headerIgst > 0 ? receipt.import_igst_amount : String(lineTotals.importIgst)
              )}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
