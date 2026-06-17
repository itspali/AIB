import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import type { DocumentModuleKey } from "@/lib/documents/types";
import type {
  PresentationModuleDefinition,
  PresentationTemplateDefinition,
  PresentationViewContext,
} from "@/lib/documents/print/types";

const PRINTABLE_MODULE_KEYS = new Set<DocumentModuleKey>([
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "SALES_QUOTATION",
]);

const MODULE_DOMAINS: Record<DocumentModuleKey, "PROCUREMENT" | "SALES"> = {
  PURCHASE_ORDER: "PROCUREMENT",
  GOODS_RECEIPT_NOTE: "PROCUREMENT",
  PURCHASE_INVOICE: "PROCUREMENT",
  SALES_QUOTATION: "SALES",
  SALES_ORDER: "SALES",
  SALES_INVOICE: "SALES",
};

const TEMPLATE_KEYS: Record<DocumentModuleKey, string> = {
  PURCHASE_ORDER: "procurement.po.standard",
  GOODS_RECEIPT_NOTE: "procurement.grn.standard",
  PURCHASE_INVOICE: "procurement.bill.standard",
  SALES_QUOTATION: "sales.quotation.standard",
  SALES_ORDER: "sales.order.standard",
  SALES_INVOICE: "sales.invoice.standard",
};

export const PRESENTATION_MODULE_DEFINITIONS: PresentationModuleDefinition[] = (
  Object.keys(DOCUMENT_LAYOUT_MODULE_ADAPTERS) as DocumentModuleKey[]
).map((moduleKey) => ({
  moduleKey,
  label: DOCUMENT_LAYOUT_MODULE_ADAPTERS[moduleKey].label,
  domain: MODULE_DOMAINS[moduleKey],
  printable: PRINTABLE_MODULE_KEYS.has(moduleKey),
}));

export const PRESENTATION_TEMPLATE_DEFINITIONS: PresentationTemplateDefinition[] =
  PRESENTATION_MODULE_DEFINITIONS.flatMap((module) => {
    const templateKey = TEMPLATE_KEYS[module.moduleKey];
    const contexts: PresentationViewContext[] = ["PDF_PRINT", "EMAIL_HTML"];
    return contexts.map((viewContext) => ({
      templateKey,
      moduleKey: module.moduleKey,
      viewContext,
      label:
        viewContext === "PDF_PRINT"
          ? `${module.label} — Print`
          : `${module.label} — Email`,
      description: `Appearance template for ${module.label.toLowerCase()} ${viewContext === "PDF_PRINT" ? "print" : "email attachment"} output.`,
      printable: module.printable,
    }));
  });

export function getPresentationModuleDefinition(
  moduleKey: DocumentModuleKey
): PresentationModuleDefinition | null {
  return PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === moduleKey) ?? null;
}

export function getPresentationTemplateKey(moduleKey: DocumentModuleKey): string {
  return TEMPLATE_KEYS[moduleKey];
}

export function groupPresentationModulesByDomain(): Record<
  "PROCUREMENT" | "SALES",
  PresentationModuleDefinition[]
> {
  return {
    PROCUREMENT: PRESENTATION_MODULE_DEFINITIONS.filter((row) => row.domain === "PROCUREMENT"),
    SALES: PRESENTATION_MODULE_DEFINITIONS.filter((row) => row.domain === "SALES"),
  };
}
