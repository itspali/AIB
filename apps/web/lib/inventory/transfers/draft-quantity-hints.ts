import type { DocumentLineStockContext } from "@/lib/inventory/stock/line-stock-context";

const QUANTITY_EPSILON = 0.0001;

export function parseTransferLineQuantity(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function transferQuantityExceedsOnHand(
  quantityDispatched: string,
  context: DocumentLineStockContext | null | undefined
): boolean {
  const qty = parseTransferLineQuantity(quantityDispatched);
  if (qty == null || !context) return false;

  const onHand = Number(context.quantity_on_hand);
  if (!Number.isFinite(onHand)) return false;

  return qty > onHand + QUANTITY_EPSILON;
}

export function countTransferLinesExceedingOnHand(
  lines: Array<{ variant_id: string; quantity_dispatched: string }>,
  getStockContext: (variantId: string) => DocumentLineStockContext | null
): number {
  let count = 0;

  for (const line of lines) {
    if (!line.variant_id.trim()) continue;
    if (!parseTransferLineQuantity(line.quantity_dispatched)) continue;
    if (transferQuantityExceedsOnHand(line.quantity_dispatched, getStockContext(line.variant_id))) {
      count += 1;
    }
  }

  return count;
}
