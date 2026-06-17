import type { DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";

export type PresentationViewContext = Extract<DocumentViewContext, "PDF_PRINT" | "EMAIL_HTML">;

export const PRESENTATION_VIEW_CONTEXTS: PresentationViewContext[] = ["PDF_PRINT", "EMAIL_HTML"];

export type PresentationPageSize = "A4" | "LETTER";
export type PresentationPageOrientation = "portrait" | "landscape";

export type PresentationShellConfig = {
  version: 1;
  page: {
    size: PresentationPageSize;
    orientation: PresentationPageOrientation;
  };
  margins: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  header: {
    showLogo: boolean;
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
};

export type PresentationStyleConfig = {
  fontFamily: string;
  fontSizePx: number;
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
