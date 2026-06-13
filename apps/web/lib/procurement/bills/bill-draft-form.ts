import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import type { BillablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";

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
  quantity_on_grns: string;
};

export type GrnPoItemAggregate = {
  quantity_received: number;
  weighted_landed_cost: number | null;
};

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
      const qty = Number(line.quantity_received);
      const unitCost = Number(line.total_final_landed_cost);
      if (!Number.isFinite(qty) || qty <= 0) continue;
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
      quantity_received: bucket.qty,
      weighted_landed_cost: bucket.qty > 0 ? bucket.value / bucket.qty : null,
    });
  }
  return result;
}

function isBillablePoLine(line: PurchaseOrderLineRow): boolean {
  if (line.is_promotional) return false;
  return Number(line.quantity_received) > 0;
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
    const qtyFromGrns = aggregate?.quantity_received;
    const qtyFromPo = Number(line.quantity_received);
    const quantity =
      qtyFromGrns != null && qtyFromGrns > 0
        ? qtyFromGrns
        : Number.isFinite(qtyFromPo) && qtyFromPo > 0
          ? qtyFromPo
          : 0;

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
      quantity_on_grns: qtyFromGrns != null ? formatQty(qtyFromGrns) : "0",
    };
  });
}

export function filterSavableBillDraftLines(lines: readonly BillDraftLine[]): BillDraftLine[] {
  return lines.filter(
    (line) => Boolean(line.variant_id) && Number(line.quantity_billed) > 0
  );
}

export function defaultSelectedGrnIdsForPo(
  grns: readonly GoodsReceiptRow[],
  purchaseOrderId: string
): string[] {
  return grns.filter((grn) => grn.purchase_order_id === purchaseOrderId).map((grn) => grn.id);
}
