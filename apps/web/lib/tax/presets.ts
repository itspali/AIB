import type { TaxCodeKind, TaxRuleBasis } from "@/lib/tax/types";

export type PresetComponent = {
  name: string;
  rate: number;
  sort_order: number;
};

export type PresetRule = {
  basis: TaxRuleBasis;
  threshold_min: number;
  threshold_max: number | null;
  rate: number;
};

export type PresetTaxCode = {
  code: string;
  name: string;
  kind: TaxCodeKind;
  rate: number;
  is_inclusive_default: boolean;
  is_variable: boolean;
  components: PresetComponent[];
  rules: PresetRule[];
};

function gstSplit(rate: number): PresetComponent[] {
  const half = rate / 2;
  return [
    { name: "CGST", rate: half, sort_order: 0 },
    { name: "SGST", rate: half, sort_order: 1 },
  ];
}

const INDIA_TAX_CODES: PresetTaxCode[] = [
  { code: "GST5", name: "GST 5%", kind: "GST", rate: 5, is_inclusive_default: false, is_variable: false, components: gstSplit(5), rules: [] },
  { code: "GST12", name: "GST 12%", kind: "GST", rate: 12, is_inclusive_default: false, is_variable: false, components: gstSplit(12), rules: [] },
  { code: "GST18", name: "GST 18%", kind: "GST", rate: 18, is_inclusive_default: false, is_variable: false, components: gstSplit(18), rules: [] },
  { code: "GST28", name: "GST 28%", kind: "GST", rate: 28, is_inclusive_default: false, is_variable: false, components: gstSplit(28), rules: [] },
  {
    code: "GST-APPAREL",
    name: "Apparel GST 5% / 12%",
    kind: "GST",
    rate: 12,
    is_inclusive_default: false,
    is_variable: true,
    components: [],
    rules: [
      { basis: "UNIT_PRICE", threshold_min: 0, threshold_max: 1000, rate: 5 },
      { basis: "UNIT_PRICE", threshold_min: 1000, threshold_max: null, rate: 12 },
    ],
  },
  { code: "EXEMPT", name: "Exempt", kind: "EXEMPT", rate: 0, is_inclusive_default: false, is_variable: false, components: [], rules: [] },
  { code: "NIL", name: "Nil-rated", kind: "NIL", rate: 0, is_inclusive_default: false, is_variable: false, components: [], rules: [] },
  { code: "ZERO-EXPORT", name: "Zero-rated (export)", kind: "ZERO", rate: 0, is_inclusive_default: false, is_variable: false, components: [], rules: [] },
  { code: "IMPORT-ZERO", name: "Import — zero vendor GST", kind: "ZERO", rate: 0, is_inclusive_default: false, is_variable: false, components: [], rules: [] },
  {
    code: "IMPORT-IGST",
    name: "Import IGST",
    kind: "GST",
    rate: 18,
    is_inclusive_default: false,
    is_variable: false,
    components: [{ name: "IGST", rate: 18, sort_order: 0 }],
    rules: [],
  },
  {
    code: "RCM-STD",
    name: "Reverse charge (import of services)",
    kind: "GST",
    rate: 18,
    is_inclusive_default: false,
    is_variable: false,
    components: [{ name: "IGST", rate: 18, sort_order: 0 }],
    rules: [],
  },
];

const US_TAX_CODES: PresetTaxCode[] = [
  { code: "SALES-STD", name: "Sales tax (standard)", kind: "SALES_TAX", rate: 0, is_inclusive_default: false, is_variable: false, components: [], rules: [] },
  { code: "TAX-EXEMPT", name: "Tax-exempt", kind: "EXEMPT", rate: 0, is_inclusive_default: false, is_variable: false, components: [], rules: [] },
];

const VAT_TAX_CODES: PresetTaxCode[] = [
  { code: "VAT-STD", name: "VAT standard", kind: "VAT", rate: 20, is_inclusive_default: true, is_variable: false, components: [], rules: [] },
  { code: "VAT-REDUCED", name: "VAT reduced", kind: "VAT", rate: 5, is_inclusive_default: true, is_variable: false, components: [], rules: [] },
  { code: "VAT-ZERO", name: "Zero-rated", kind: "ZERO", rate: 0, is_inclusive_default: false, is_variable: false, components: [], rules: [] },
  { code: "VAT-EXEMPT", name: "Exempt", kind: "EXEMPT", rate: 0, is_inclusive_default: false, is_variable: false, components: [], rules: [] },
];

export function defaultTaxCodesForCountry(countryCode: string): PresetTaxCode[] {
  const code = countryCode.toUpperCase();
  if (code === "IN") return INDIA_TAX_CODES.map((entry) => ({ ...entry }));
  if (code === "US") return US_TAX_CODES.map((entry) => ({ ...entry }));
  return VAT_TAX_CODES.map((entry) => ({ ...entry }));
}
