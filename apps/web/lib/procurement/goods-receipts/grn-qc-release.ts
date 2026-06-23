import type { DocumentLinePeekColumn } from "@/components/documents/document-line-peek-table";
import {
  computeDocumentLineMinTableWidth,
  getDocumentLineColumnMinWidthRem,
  getDocumentLineColumnWidthClass,
  getDocumentLineColumnWidthRem,
} from "@/lib/documents/line-column-widths";
import type { GoodsReceiptLineRow } from "@/lib/procurement/goods-receipts/types";
import { grnStockColumnLabel } from "@/lib/procurement/qc-receipt-policy";

function grnPeekNumericColumn(
  id: string,
  label: string,
  options?: { headerClassName?: string }
): DocumentLinePeekColumn {
  return {
    id,
    label,
    align: "right",
    widthClass: getDocumentLineColumnWidthClass(id),
    colWidthRem: getDocumentLineColumnWidthRem(id),
    headerClassName: options?.headerClassName,
  };
}

export function parseGrnStoredQuantity(value: string | undefined): number {
  if (value == null || value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export function formatGrnDisplayQuantity(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4).replace(/\.?0+$/, "");
}

/** Dock-level exceptions recorded at receipt (unchanged after QC release). */
export function grnLineDockExceptions(line: GoodsReceiptLineRow): number {
  const received = parseGrnStoredQuantity(line.quantity_received);
  const accepted = parseGrnStoredQuantity(line.quantity_accepted);
  return Math.max(received - accepted, 0);
}

/** Units rejected during quality inspection (excludes dock exceptions). */
export function grnLineQcRejected(line: GoodsReceiptLineRow): number {
  const totalRejected = parseGrnStoredQuantity(line.quantity_rejected);
  return Math.max(totalRejected - grnLineDockExceptions(line), 0);
}

/** Units posted to stock after dock receipt and any QC release. */
export function grnLinePostedToStock(line: GoodsReceiptLineRow): number {
  const accepted = parseGrnStoredQuantity(line.quantity_accepted);
  return Math.max(accepted - grnLineQcRejected(line), 0);
}

export function grnLineQcHoldQuantity(line: GoodsReceiptLineRow): number {
  if (line.quantity_on_qc_hold != null && line.quantity_on_qc_hold.trim() !== "") {
    const hold = Number(line.quantity_on_qc_hold);
    if (Number.isFinite(hold)) return Math.max(hold, 0);
  }

  const accepted = Number(line.quantity_accepted);
  return Number.isFinite(accepted) ? Math.max(accepted, 0) : 0;
}

export function grnLinesAwaitingQcRelease(lines: GoodsReceiptLineRow[]): GoodsReceiptLineRow[] {
  return lines.filter((line) => {
    if (!line.id) return false;
    if (grnLineQcHoldQuantity(line) <= 0) return false;
    if (line.route_to_qc === false) {
      return line.is_promotional === true;
    }
    return true;
  });
}

export function parseGrnQcReleaseQuantities(
  onHold: number,
  passRaw: string,
  rejectRaw: string
): { pass: number; reject: number; error?: string } {
  const pass = passRaw.trim() === "" ? onHold : Number(passRaw);
  const reject = rejectRaw.trim() === "" ? 0 : Number(rejectRaw);

  if (!Number.isFinite(pass) || pass < 0) {
    return { pass: 0, reject: 0, error: "Pass quantity is invalid." };
  }
  if (!Number.isFinite(reject) || reject < 0) {
    return { pass: 0, reject: 0, error: "Reject quantity is invalid." };
  }
  if (pass <= 0 && reject <= 0) {
    return { pass: 0, reject: 0, error: "Enter a pass or reject quantity." };
  }
  if (pass + reject > onHold + 0.0001) {
    return {
      pass: 0,
      reject: 0,
      error: `Pass and reject cannot exceed ${onHold} on hold.`,
    };
  }

  return { pass, reject };
}

export function sumGrnQcHoldQuantities(lines: GoodsReceiptLineRow[]): number {
  return lines.reduce((sum, line) => sum + grnLineQcHoldQuantity(line), 0);
}

function formatGrnQcQuantity(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function clampGrnQcQuantity(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

/** When pass changes, reject is set to the remaining on-hold quantity. */
export function syncGrnQcPassQuantity(
  onHold: number,
  passRaw: string
): { pass: string; reject: string } {
  if (passRaw.trim() === "") {
    return { pass: "", reject: formatGrnQcQuantity(onHold) };
  }

  const passNum = Number(passRaw);
  if (!Number.isFinite(passNum)) {
    return { pass: passRaw, reject: formatGrnQcQuantity(onHold) };
  }

  const pass = clampGrnQcQuantity(passNum, onHold);
  const reject = onHold - pass;
  return {
    pass: formatGrnQcQuantity(pass),
    reject: formatGrnQcQuantity(reject),
  };
}

/** When reject changes, pass is set to the remaining on-hold quantity. */
export function syncGrnQcRejectQuantity(
  onHold: number,
  rejectRaw: string
): { pass: string; reject: string } {
  if (rejectRaw.trim() === "") {
    return { pass: formatGrnQcQuantity(onHold), reject: "" };
  }

  const rejectNum = Number(rejectRaw);
  if (!Number.isFinite(rejectNum)) {
    return { pass: formatGrnQcQuantity(onHold), reject: rejectRaw };
  }

  const reject = clampGrnQcQuantity(rejectNum, onHold);
  const pass = onHold - reject;
  return {
    pass: formatGrnQcQuantity(pass),
    reject: formatGrnQcQuantity(reject),
  };
}

export function buildGrnPeekLineColumns(options: {
  isQcPending: boolean;
  qcModuleEnabled: boolean;
  showLineImportTax: boolean;
}): DocumentLinePeekColumn[] {
  const { isQcPending, qcModuleEnabled, showLineImportTax } = options;

  const quantityColumns: DocumentLinePeekColumn[] = isQcPending
    ? [
        grnPeekNumericColumn("quantity_received", "Received"),
        grnPeekNumericColumn("quantity_rejected", "Exceptions"),
        grnPeekNumericColumn("quantity_on_hold", "On hold"),
      ]
    : qcModuleEnabled
      ? [
          grnPeekNumericColumn("quantity_received", "Received"),
          grnPeekNumericColumn("dock_exceptions", "Dock exc."),
          grnPeekNumericColumn("posted_to_stock", "Posted to stock", {
            headerClassName: "whitespace-normal leading-tight",
          }),
          grnPeekNumericColumn("qc_rejected", "QC reject"),
        ]
      : [
          grnPeekNumericColumn("quantity_received", "Received"),
          grnPeekNumericColumn("quantity_rejected", "Exceptions"),
          grnPeekNumericColumn("quantity_accepted", grnStockColumnLabel(false)),
        ];

  return [
    {
      id: "item",
      label: "Item",
      align: "left",
      widthClass: getDocumentLineColumnWidthClass("item"),
      colMinWidthRem: getDocumentLineColumnMinWidthRem("item"),
    },
    ...quantityColumns,
    grnPeekNumericColumn("raw_unit_cost", "Unit cost"),
    ...(showLineImportTax
      ? [
          grnPeekNumericColumn("customs_duty_amount", "Customs"),
          grnPeekNumericColumn("import_igst_amount", "Import IGST", {
            headerClassName: "whitespace-normal leading-tight",
          }),
        ]
      : []),
  ];
}

export function buildGrnPeekLineMinTableWidth(
  columns: DocumentLinePeekColumn[],
  showLineNumbers = true
): string {
  const columnIds = columns.map((column) => column.id);
  return computeDocumentLineMinTableWidth(columnIds, {
    lineNumber: showLineNumbers,
    remove: false,
  });
}

export function grnPeekLineCellValue(
  columnId: string,
  line: GoodsReceiptLineRow,
  isQcPending: boolean
): string {
  switch (columnId) {
    case "quantity_received":
      return line.quantity_received;
    case "quantity_rejected":
      return line.quantity_rejected;
    case "quantity_on_hold":
      return formatGrnDisplayQuantity(grnLineQcHoldQuantity(line));
    case "dock_exceptions":
      return formatGrnDisplayQuantity(grnLineDockExceptions(line));
    case "posted_to_stock":
      return formatGrnDisplayQuantity(grnLinePostedToStock(line));
    case "qc_rejected":
      return formatGrnDisplayQuantity(grnLineQcRejected(line));
    case "quantity_accepted":
      return isQcPending
        ? formatGrnDisplayQuantity(grnLineQcHoldQuantity(line))
        : line.quantity_accepted;
    case "customs_duty_amount":
      return line.customs_duty_amount;
    case "import_igst_amount":
      return line.import_igst_amount;
    default:
      return line.raw_unit_cost;
  }
}
