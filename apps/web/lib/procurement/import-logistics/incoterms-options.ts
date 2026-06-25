/** Common Incoterms 2020 codes for import purchase and shipment documents. */
export const INCOTERMS_OPTIONS = [
  { code: "EXW", label: "EXW — Ex works" },
  { code: "FCA", label: "FCA — Free carrier" },
  { code: "FAS", label: "FAS — Free alongside ship" },
  { code: "FOB", label: "FOB — Free on board" },
  { code: "CFR", label: "CFR — Cost and freight" },
  { code: "CIF", label: "CIF — Cost, insurance & freight" },
  { code: "CPT", label: "CPT — Carriage paid to" },
  { code: "CIP", label: "CIP — Carriage & insurance paid to" },
  { code: "DAP", label: "DAP — Delivered at place" },
  { code: "DPU", label: "DPU — Delivered at place unloaded" },
  { code: "DDP", label: "DDP — Delivered duty paid" },
] as const;

export type IncotermsCode = (typeof INCOTERMS_OPTIONS)[number]["code"];

export const INCOTERMS_OTHER_VALUE = "__OTHER__";
