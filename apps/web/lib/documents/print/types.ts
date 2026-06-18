import type { DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";

export type PresentationViewContext = Extract<DocumentViewContext, "PDF_PRINT" | "EMAIL_HTML">;

export const PRESENTATION_VIEW_CONTEXTS: PresentationViewContext[] = ["PDF_PRINT", "EMAIL_HTML"];

export type PresentationPageSize = "A4" | "LETTER";
export type PresentationPageOrientation = "portrait" | "landscape";
export type PresentationLogoPlacement = "top" | "left";

export type PresentationSpacingValues = {
  top: string;
  bottom: string;
  left: string;
  right: string;
};

export type PresentationShellConfig = {
  version: 1;
  page: {
    size: PresentationPageSize;
    orientation: PresentationPageOrientation;
  };
  margins: PresentationSpacingValues;
  padding: PresentationSpacingValues;
  header: {
    showLogo: boolean;
    logoPlacement: PresentationLogoPlacement;
    logoMaxHeightPx: number;
    logoMaxWidthPx: number;
    showOrgName: boolean;
    showOrgAddress: boolean;
    showDocumentTitle: boolean;
    titleOverride: string | null;
  };
  footer: {
    showPageNumbers: boolean;
    legalText: string;
  };
  sections: {
    showHeaderFields: boolean;
    showLineTable: boolean;
    showTotals: boolean;
    showTerms: boolean;
    termsText: string;
  };
  compliance?: {
    pack: "standard" | "gst_tax_invoice";
    showPlaceOfSupply: boolean;
    showIrnPlaceholder: boolean;
    statutoryNote: string;
  };
};

export type PresentationLayoutTheme =
  | "standard"
  | "compact"
  | "detailed"
  | "minimal"
  | "formal"
  | "branded"
  | "modern"
  | "trade"
  | "classic"
  | "industrial"
  | "retail";

export type PresentationStyleConfig = {
  fontFamily: string;
  fontSizePx: number;
  layoutTheme?: PresentationLayoutTheme;
};

export type DocumentPresentationTemplate = {
  templateKey: string;
  moduleKey: DocumentModuleKey;
  viewContext: PresentationViewContext;
  label: string;
  description: string | null;
  shellConfig: PresentationShellConfig;
  styleConfig: PresentationStyleConfig;
  isDefault: boolean;
  isActive: boolean;
  isCustomized: boolean;
};

export type DocumentOrgRenderContext = {
  organizationName: string;
  legalName: string | null;
  tradeName: string | null;
  taxIdentifier: string | null;
  addressLines: string[];
  logoUrl: string | null;
  websiteUrl: string | null;
  locale: string;
};

export type PresentationTemplateDefinition = {
  templateKey: string;
  moduleKey: DocumentModuleKey;
  viewContext: PresentationViewContext;
  label: string;
  description: string;
  printable: boolean;
};

export type PresentationModuleDefinition = {
  moduleKey: DocumentModuleKey;
  label: string;
  domain: "PROCUREMENT" | "SALES";
  printable: boolean;
};
