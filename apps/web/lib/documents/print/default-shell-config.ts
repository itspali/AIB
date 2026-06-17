import type { PresentationShellConfig, PresentationStyleConfig } from "@/lib/documents/print/types";

export const DEFAULT_PRESENTATION_SHELL_CONFIG: PresentationShellConfig = {
  version: 1,
  page: { size: "A4", orientation: "portrait" },
  margins: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
  header: {
    showLogo: true,
    showOrgName: true,
    showOrgAddress: true,
    showDocumentTitle: true,
    titleOverride: null,
  },
  footer: {
    showPageNumbers: false,
    legalText: "",
  },
  sections: {
    showHeaderFields: true,
    showLineTable: true,
    showTotals: true,
    showTerms: false,
    termsText: "",
  },
};

export const DEFAULT_PRESENTATION_STYLE_CONFIG: PresentationStyleConfig = {
  fontFamily: "system-ui, sans-serif",
  fontSizePx: 12,
};

export function normalizePresentationShellConfig(
  raw: Partial<PresentationShellConfig> | null | undefined
): PresentationShellConfig {
  const base = DEFAULT_PRESENTATION_SHELL_CONFIG;
  if (!raw || typeof raw !== "object") return base;

  return {
    version: 1,
    page: {
      size: raw.page?.size === "LETTER" ? "LETTER" : base.page.size,
      orientation: raw.page?.orientation === "landscape" ? "landscape" : base.page.orientation,
    },
    margins: {
      top: typeof raw.margins?.top === "string" ? raw.margins.top : base.margins.top,
      bottom: typeof raw.margins?.bottom === "string" ? raw.margins.bottom : base.margins.bottom,
      left: typeof raw.margins?.left === "string" ? raw.margins.left : base.margins.left,
      right: typeof raw.margins?.right === "string" ? raw.margins.right : base.margins.right,
    },
    header: {
      showLogo: raw.header?.showLogo ?? base.header.showLogo,
      showOrgName: raw.header?.showOrgName ?? base.header.showOrgName,
      showOrgAddress: raw.header?.showOrgAddress ?? base.header.showOrgAddress,
      showDocumentTitle: raw.header?.showDocumentTitle ?? base.header.showDocumentTitle,
      titleOverride:
        typeof raw.header?.titleOverride === "string"
          ? raw.header.titleOverride
          : raw.header?.titleOverride === null
            ? null
            : base.header.titleOverride,
    },
    footer: {
      showPageNumbers: raw.footer?.showPageNumbers ?? base.footer.showPageNumbers,
      legalText: typeof raw.footer?.legalText === "string" ? raw.footer.legalText : base.footer.legalText,
    },
    sections: {
      showHeaderFields: raw.sections?.showHeaderFields ?? base.sections.showHeaderFields,
      showLineTable: raw.sections?.showLineTable ?? base.sections.showLineTable,
      showTotals: raw.sections?.showTotals ?? base.sections.showTotals,
      showTerms: raw.sections?.showTerms ?? base.sections.showTerms,
      termsText: typeof raw.sections?.termsText === "string" ? raw.sections.termsText : base.sections.termsText,
    },
  };
}

export function normalizePresentationStyleConfig(
  raw: Partial<PresentationStyleConfig> | null | undefined
): PresentationStyleConfig {
  const base = DEFAULT_PRESENTATION_STYLE_CONFIG;
  if (!raw || typeof raw !== "object") return base;

  return {
    fontFamily: typeof raw.fontFamily === "string" ? raw.fontFamily : base.fontFamily,
    fontSizePx:
      typeof raw.fontSizePx === "number" && Number.isFinite(raw.fontSizePx)
        ? raw.fontSizePx
        : base.fontSizePx,
  };
}
