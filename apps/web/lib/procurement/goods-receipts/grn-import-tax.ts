import type { GoodsReceiptLineRow, GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";

function toAmount(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function grnHasImportTaxContext(receipt: Pick<
  GoodsReceiptRow,
  | "bill_of_entry_number"
  | "bill_of_entry_date"
  | "assessable_value"
  | "customs_duty_amount"
  | "import_igst_amount"
  | "lines"
>): boolean {
  if (receipt.bill_of_entry_number?.trim()) return true;
  if (receipt.bill_of_entry_date) return true;
  if (toAmount(receipt.assessable_value) > 0) return true;
  if (toAmount(receipt.customs_duty_amount) > 0) return true;
  if (toAmount(receipt.import_igst_amount) > 0) return true;

  return (receipt.lines ?? []).some(
    (line) =>
      toAmount(line.import_igst_amount) > 0 || toAmount(line.customs_duty_amount) > 0
  );
}

export function sumGrnLineImportTax(lines: GoodsReceiptLineRow[]): {
  importIgst: number;
  customsDuty: number;
} {
  return lines.reduce(
    (totals, line) => ({
      importIgst: totals.importIgst + toAmount(line.import_igst_amount),
      customsDuty: totals.customsDuty + toAmount(line.customs_duty_amount),
    }),
    { importIgst: 0, customsDuty: 0 }
  );
}

export function grnLineHasImportTax(line: GoodsReceiptLineRow): boolean {
  return toAmount(line.import_igst_amount) > 0 || toAmount(line.customs_duty_amount) > 0;
}
