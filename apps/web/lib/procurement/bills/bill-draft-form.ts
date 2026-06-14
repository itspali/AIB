import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import { resolveBillLineQuantitySeverity } from "@/lib/procurement/bills/three-way-match";
import type { BillablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";
import type { GoodsReceiptLineRow } from "@/lib/procurement/goods-receipts/types";

export type BillDraftLine = {
  key: string;
  po_item_id: string | null;
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_sku: string;
  quantity_billed: string;
  unit_price_billed: string;
  po_unit_price: string;
  grn_landed_unit_cost: string | null;
  /** Aggregated accepted quantity on selected GRNs (QC-aware). */
  quantity_on_grns: string;
  /** Already invoiced on the PO line (excludes current bill line when editing). */
  quantity_already_invoiced: string;
};

export type GrnPoItemAggregate = {
  quantity_accepted: number;
  weighted_landed_cost: number | null;
};

function effectiveGrnAcceptedQty(line: GoodsReceiptLineRow): number {
  const accepted = Number(line.quantity_accepted);
  const received = Number(line.quantity_received);
  if (Number.isFinite(accepted) && accepted > 0) return accepted;
  if (Number.isFinite(received) && received > 0) return received;
  return 0;
}

export function aggregateGrnQuantitiesByPoItem(
  grns: readonly GoodsReceiptRow[],
  selectedGrnIds: readonly string[]
): Map<string, GrnPoItemAggregate> {
  const selected = new Set(selectedGrnIds);
  const map = new Map<string, { qty: number; value: number }>();

  for (const grn of grns) {
    if (!selected.has(grn.id)) continue;
    for (const line of grn.lines ?? []) {
      if (!line.po_item_id) continue;
      const qty = effectiveGrnAcceptedQty(line);
      const unitCost = Number(line.total_final_landed_cost);
      if (qty <= 0) continue;
      const current = map.get(line.po_item_id) ?? { qty: 0, value: 0 };
      current.qty += qty;
      if (Number.isFinite(unitCost)) {
        current.value += qty * unitCost;
      }
      map.set(line.po_item_id, current);
    }
  }

  const result = new Map<string, GrnPoItemAggregate>();
  for (const [poItemId, bucket] of map.entries()) {
    result.set(poItemId, {
      quantity_accepted: bucket.qty,
      weighted_landed_cost: bucket.qty > 0 ? bucket.value / bucket.qty : null,
    });
  }
  return result;
}

function isBillablePoLine(line: PurchaseOrderLineRow): boolean {
  if (line.is_promotional) return false;
  return Number(line.quantity_received) > 0;
}

function poLineAlreadyInvoiced(line: PurchaseOrderLineRow): number {
  const invoiced = Number(line.quantity_invoiced ?? 0);
  return Number.isFinite(invoiced) && invoiced > 0 ? invoiced : 0;
}

function poLineBillableRemaining(line: PurchaseOrderLineRow, acceptedOnGrns: number): number {
  const invoiced = poLineAlreadyInvoiced(line);
  if (acceptedOnGrns > 0) {
    return Math.max(acceptedOnGrns - invoiced, 0);
  }
  const received = Number(line.quantity_received);
  if (!Number.isFinite(received) || received <= 0) return 0;
  return Math.max(received - invoiced, 0);
}

function formatQty(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, "") || "0";
}

function formatMoney(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(4).replace(/\.?0+$/, "") || "0";
}

export function buildBillDraftLinesFromPo(
  order: BillablePurchaseOrderOption,
  grns: readonly GoodsReceiptRow[],
  selectedGrnIds: readonly string[]
): BillDraftLine[] {
  const aggregates = aggregateGrnQuantitiesByPoItem(grns, selectedGrnIds);
  const billableLines = order.lines.filter(isBillablePoLine);

  return billableLines.map((line) => {
    const aggregate = line.id ? aggregates.get(line.id) : undefined;
    const acceptedOnGrns = aggregate?.quantity_accepted ?? 0;
    const alreadyInvoiced = poLineAlreadyInvoiced(line);
    const quantity = poLineBillableRemaining(line, acceptedOnGrns);

    return {
      key: line.id,
      po_item_id: line.id,
      variant_id: line.variant_id,
      item_id: line.item_id,
      item_name: line.item_name,
      variant_sku: line.variant_sku,
      quantity_billed: formatQty(quantity),
      unit_price_billed: line.unit_price_contractual,
      po_unit_price: line.unit_price_contractual,
      grn_landed_unit_cost: formatMoney(aggregate?.weighted_landed_cost ?? null),
      quantity_on_grns: acceptedOnGrns > 0 ? formatQty(acceptedOnGrns) : "0",
      quantity_already_invoiced: formatQty(alreadyInvoiced),
    };
  });
}

export function filterSavableBillDraftLines(lines: readonly BillDraftLine[]): BillDraftLine[] {
  return lines.filter(
    (line) => Boolean(line.variant_id) && Number(line.quantity_billed) > 0
  );
}

export function validateBillDraftLineQuantities(lines: readonly BillDraftLine[]): string | null {
  for (const line of lines) {
    const qty = Number(line.quantity_billed);
    const onGrns = Number(line.quantity_on_grns);
    const alreadyInvoiced = Number(line.quantity_already_invoiced);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const severity = resolveBillLineQuantitySeverity(qty, onGrns, alreadyInvoiced);
    if (severity === "overage") {
      const allowed = Math.max(onGrns - alreadyInvoiced, 0);
      return `${line.item_name}: quantity billed (${line.quantity_billed}) exceeds remaining billable quantity (${formatQty(allowed)} accepted on GRNs, ${formatQty(alreadyInvoiced)} already invoiced).`;
    }
  }
  return null;
}

export function defaultSelectedGrnIdsForPo(
  grns: readonly GoodsReceiptRow[],
  purchaseOrderId: string
): string[] {
  return grns.filter((grn) => grn.purchase_order_id === purchaseOrderId).map((grn) => grn.id);
}
