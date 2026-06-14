import type { GoodsReceiptLineRow } from "@/lib/procurement/goods-receipts/types";

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
