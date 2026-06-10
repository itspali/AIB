import type { ItemTaxCodeRow } from "@/lib/tax/item-tax-code-picker";
import type { TaxComponentRow } from "@/lib/tax/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";

/** Tenant tax rule row used by the PO line GST picker. */
export type PoLineTaxCodeOption = ItemTaxCodeRow & {
  components: TaxComponentRow[];
};

export function patchPoLineTaxCodeSelection(
  line: PoDraftLine,
  taxCodeId: string,
  options: readonly PoLineTaxCodeOption[]
): Partial<PoDraftLine> {
  if (!line.catalog_context) return {};

  const selected = options.find((entry) => entry.id === taxCodeId);
  if (!selected) return {};

  return {
    catalog_context: {
      ...line.catalog_context,
      tax_code_id: selected.id,
      tax_rate: selected.rate,
      tax_is_variable: selected.is_variable,
      tax_components: selected.components.map((component) => ({ ...component })),
    },
  };
}
