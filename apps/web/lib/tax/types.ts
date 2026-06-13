export const TAX_CODE_KINDS = [
  "GST",
  "VAT",
  "SALES_TAX",
  "EXEMPT",
  "NIL",
  "ZERO",
] as const;

export type TaxCodeKind = (typeof TAX_CODE_KINDS)[number];

export function isTaxCodeKind(value: string): value is TaxCodeKind {
  return (TAX_CODE_KINDS as readonly string[]).includes(value);
}

export function taxCodeKindLabel(kind: TaxCodeKind): string {
  switch (kind) {
    case "GST":
      return "GST";
    case "VAT":
      return "VAT";
    case "SALES_TAX":
      return "Sales tax";
    case "EXEMPT":
      return "Exempt";
    case "NIL":
      return "Nil-rated";
    case "ZERO":
      return "Zero-rated";
    default:
      return kind;
  }
}

export const TAX_RULE_BASES = ["UNIT_PRICE", "LINE_VALUE", "QTY"] as const;

export type TaxRuleBasis = (typeof TAX_RULE_BASES)[number];

export function taxRuleBasisLabel(basis: TaxRuleBasis): string {
  switch (basis) {
    case "UNIT_PRICE":
      return "Per-unit value (after discount)";
    case "LINE_VALUE":
      return "Line value";
    case "QTY":
      return "Quantity";
    default:
      return basis;
  }
}

/** A single tax sub-component (CGST / SGST / IGST / CESS …). */
export type TaxComponentRow = {
  name: string;
  rate: number;
  sort_order: number;
};

/** A slab tier resolved at transaction time for variable codes. */
export type TaxRuleRow = {
  id: string | null;
  basis: TaxRuleBasis;
  threshold_min: number;
  threshold_max: number | null;
  rate: number;
  effective_from: string | null;
  effective_to: string | null;
};

/** A full tax code as read from the database. */
export type TaxCodeRow = {
  id: string;
  code: string;
  name: string;
  kind: TaxCodeKind;
  rate: number;
  is_inclusive_default: boolean;
  is_variable: boolean;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
  is_recoverable: boolean;
  components: TaxComponentRow[];
  rules: TaxRuleRow[];
  created_at: string;
  updated_at: string;
};

/** Form-side component entry (string-backed numeric inputs). */
export type TaxComponentFormEntry = {
  name: string;
  rate: string;
  sort_order: number;
};

/** Form-side slab entry (string-backed numeric inputs). */
export type TaxRuleFormEntry = {
  basis: TaxRuleBasis;
  threshold_min: string;
  threshold_max: string;
  rate: string;
};

/** Values captured by the tax code drawer form. */
export type TaxCodeFormValues = {
  tax_code_id?: string | null;
  code: string;
  name: string;
  kind: TaxCodeKind;
  rate: string;
  is_inclusive_default: boolean;
  is_variable: boolean;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
  is_recoverable: boolean;
  components: TaxComponentFormEntry[];
  rules: TaxRuleFormEntry[];
};

export const defaultTaxCodeFormValues: TaxCodeFormValues = {
  tax_code_id: null,
  code: "",
  name: "",
  kind: "GST",
  rate: "0",
  is_inclusive_default: false,
  is_variable: false,
  effective_from: null,
  effective_to: null,
  is_active: true,
  is_recoverable: true,
  components: [],
  rules: [],
};
