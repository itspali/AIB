import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";

export function isPromotionalPoLine(line: PoDraftLine): boolean {
  const unit = Number(line.unit_price_contractual);
  return line.is_promotional === true || (Number.isFinite(unit) && unit === 0);
}

export function paidPoLinesForPromoLink(lines: PoDraftLine[], excludeKey: string): PoDraftLine[] {
  return lines.filter(
    (line) =>
      line.key !== excludeKey &&
      line.variant_id &&
      !isPromotionalPoLine(line) &&
      Number(line.unit_price_contractual) > 0
  );
}

export function validatePoPromoLines(lines: PoDraftLine[]): string | null {
  for (const line of lines) {
    if (!isPromotionalPoLine(line) || !line.variant_id) continue;
    if (!line.linked_parent_line_key && !line.linked_parent_line_id) {
      return "Each free goods line must be linked to a paid line on the same order.";
    }
    if (!line.promotional_category?.trim()) {
      return "Enter a promotional category for each free goods line.";
    }
  }
  return null;
}

export function assignPromoGroups(lines: PoDraftLine[]): PoDraftLine[] {
  const keyToLine = new Map(lines.map((line) => [line.key, line]));
  return lines.map((line) => {
    if (!isPromotionalPoLine(line) || !line.variant_id) {
      return { ...line, is_promotional: false };
    }

    const parentKey = line.linked_parent_line_key;
    const parent = parentKey ? keyToLine.get(parentKey) : null;
    const promoGroupId = line.promo_group_id || parent?.promo_group_id || crypto.randomUUID();

    return {
      ...line,
      is_promotional: true,
      promo_group_id: promoGroupId,
    };
  });
}

/** Resolve promo parent linkage for save — never send draft line keys as linked_parent_line_id. */
export function resolvePromoParentForSave(
  line: PoDraftLine,
  parent: PoDraftLine | null | undefined,
  persistedPoItemIds: ReadonlySet<string>
): {
  linked_parent_line_id?: string;
  linked_parent_variant_id?: string;
} {
  if (!parent?.variant_id) {
    if (line.linked_parent_line_id && persistedPoItemIds.has(line.linked_parent_line_id)) {
      return { linked_parent_line_id: line.linked_parent_line_id };
    }
    return {};
  }

  return {
    ...(persistedPoItemIds.has(parent.key) ? { linked_parent_line_id: parent.key } : {}),
    linked_parent_variant_id: parent.variant_id,
  };
}
