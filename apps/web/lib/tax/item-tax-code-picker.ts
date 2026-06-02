/**
 * Item master tax rule picker — shows full GST rate rules, not lone CGST/SGST components.
 */

export type ItemTaxCodeRow = {
  id: string;
  code: string;
  name: string;
  rate: number;
  kind: string;
  is_variable: boolean;
};

export type ItemTaxCodePickerOption = ItemTaxCodeRow & {
  pickerLabel: string;
  pickerDescription: string;
};

/** Legacy onboarding/registry rows that are statutory components, not item-level rates. */
export function isLegacyComponentOnlyTaxCode(code: Pick<ItemTaxCodeRow, "name" | "code">): boolean {
  const name = code.name.trim().toUpperCase();
  if (/^CGST([_\s./-]|\d|$)/.test(name)) return true;
  if (/^SGST([_\s./-]|\d|$)/.test(name)) return true;
  return false;
}

function formatRatePercent(rate: number): string {
  if (!Number.isFinite(rate)) return "0";
  const rounded = Math.round(rate * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

/** User-facing label for the item Tax rule dropdown (closed trigger + menu title). */
export function itemTaxCodePickerLabel(code: Pick<ItemTaxCodeRow, "name" | "rate" | "kind" | "is_variable">): string {
  if (code.is_variable) {
    return code.name.trim();
  }

  const kind = code.kind.trim().toUpperCase();
  if (kind === "EXEMPT" || kind === "NIL" || kind === "ZERO") {
    return code.name.trim();
  }

  const name = code.name.trim();
  const upper = name.toUpperCase();
  const rateLabel = formatRatePercent(code.rate);

  if (/^IGST([_\s./-]|\d|$)/.test(upper) && code.rate > 0) {
    return `GST ${rateLabel}%`;
  }

  if (/^GST\s*\d/i.test(name) || /^GST[-\s]/i.test(name)) {
    return name;
  }

  if (/\d/.test(name)) {
    return name;
  }

  return `${name} (${rateLabel}%)`;
}

/** Helper line under each option in the Tax rule menu. */
export function itemTaxCodePickerDescription(
  code: Pick<ItemTaxCodeRow, "name" | "rate" | "kind" | "is_variable">,
  options?: { isStaleLegacySelection?: boolean }
): string {
  if (options?.isStaleLegacySelection) {
    return "This is only half of a GST rate. Pick a full rate such as GST 18% instead.";
  }

  if (code.is_variable) {
    return "Tax % depends on price or quantity when you create the bill.";
  }

  const kind = code.kind.trim().toUpperCase();
  if (kind === "EXEMPT" || kind === "NIL") {
    return "No tax on the bill. Set Tax category on the item for how it is reported.";
  }
  if (kind === "ZERO") {
    return "0% tax. Still set Tax category and product code for GST records.";
  }

  if (code.rate === 0) {
    return "No tax charged when this rule is used.";
  }

  return `${formatRatePercent(code.rate)}% GST on this item. Your bill picks state vs interstate split automatically.`;
}

export function resolveItemTaxCodePickerOptions(
  codes: readonly ItemTaxCodeRow[],
  options?: { includeTaxCodeId?: string | null }
): ItemTaxCodePickerOption[] {
  const selectedId = options?.includeTaxCodeId ?? null;

  return codes
    .filter((code) => !isLegacyComponentOnlyTaxCode(code) || code.id === selectedId)
    .map((code) => {
      const isStaleLegacySelection =
        code.id === selectedId && isLegacyComponentOnlyTaxCode(code);
      return {
        ...code,
        pickerLabel: itemTaxCodePickerLabel(code),
        pickerDescription: itemTaxCodePickerDescription(code, { isStaleLegacySelection }),
      };
    })
    .sort((a, b) => {
      if (a.is_variable !== b.is_variable) return a.is_variable ? 1 : -1;
      if (a.rate !== b.rate) return a.rate - b.rate;
      return a.pickerLabel.localeCompare(b.pickerLabel);
    });
}
