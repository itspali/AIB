export type ReceiptQuantityLine = {
  line_id: string;
  variant_sku?: string;
  quantity_dispatched: string;
  quantity_accepted: string;
  quantity_damaged: string;
  quantity_lost: string;
};

export function parseReceiptQuantity(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

export function validateReceiptLines(lines: ReceiptQuantityLine[]): string | null {
  for (const line of lines) {
    const dispatched = parseReceiptQuantity(line.quantity_dispatched);
    const accepted = parseReceiptQuantity(line.quantity_accepted);
    const damaged = parseReceiptQuantity(line.quantity_damaged);
    const lost = parseReceiptQuantity(line.quantity_lost);
    const label = line.variant_sku?.trim() || "a line";

    if (
      !Number.isFinite(dispatched) ||
      !Number.isFinite(accepted) ||
      !Number.isFinite(damaged) ||
      !Number.isFinite(lost)
    ) {
      return `Enter valid non-negative quantities for ${label}.`;
    }

    const total = accepted + damaged + lost;
    if (total > dispatched) {
      return `Receipt totals for ${label} cannot exceed dispatched quantity (${dispatched}).`;
    }

    if (total < dispatched) {
      return `Account for all dispatched units on ${label} (accepted + damaged + lost must equal ${dispatched}).`;
    }
  }

  return null;
}
