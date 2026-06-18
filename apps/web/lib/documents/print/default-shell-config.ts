import type {
  PresentationShellConfig,
  PresentationSpacingValues,
  PresentationStyleConfig,
} from "@/lib/documents/print/types";
import { normalizePresentationLayoutTheme } from "@/lib/documents/print/presentation-layout-themes";

export const DEFAULT_PRESENTATION_PAGE_MARGINS: PresentationSpacingValues = {
  top: "12mm",
  bottom: "12mm",
  left: "10mm",
  right: "10mm",
};

export const DEFAULT_PRESENTATION_CONTENT_PADDING: PresentationSpacingValues = {
  top: "24px",
  bottom: "24px",
  left: "24px",
  right: "24px",
};

export function presentationSpacingToCss(values: PresentationSpacingValues): string {
  return `${values.top} ${values.right} ${values.bottom} ${values.left}`;
}

function normalizeSpacingValues(
  raw: Partial<PresentationSpacingValues> | null | undefined,
  fallback: PresentationSpacingValues
): PresentationSpacingValues {
  return {
    top: typeof raw?.top === "string" ? raw.top : fallback.top,
    bottom: typeof raw?.bottom === "string" ? raw.bottom : fallback.bottom,
    left: typeof raw?.left === "string" ? raw.left : fallback.left,
    right: typeof raw?.right === "string" ? raw.right : fallback.right,
  };
}

export const DEFAULT_PRESENTATION_LOGO_MAX_HEIGHT_PX = 48;
export const DEFAULT_PRESENTATION_LOGO_MAX_WIDTH_PX = 180;
export const PRESENTATION_LOGO_HEIGHT_MIN_PX = 24;
export const PRESENTATION_LOGO_HEIGHT_MAX_PX = 120;
export const PRESENTATION_LOGO_WIDTH_MIN_PX = 60;
export const PRESENTATION_LOGO_WIDTH_MAX_PX = 320;

function normalizeLogoDimension(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeLogoPlacement(value: unknown): PresentationShellConfig["header"]["logoPlacement"] {
  return value === "left" ? "left" : "top";
}

export const DEFAULT_PRESENTATION_SHELL_CONFIG: PresentationShellConfig = {
  version: 1,
  page: { size: "A4", orientation: "portrait" },
  margins: DEFAULT_PRESENTATION_PAGE_MARGINS,
  padding: DEFAULT_PRESENTATION_CONTENT_PADDING,
  header: {
    showLogo: true,
    logoPlacement: "top",
    logoMaxHeightPx: DEFAULT_PRESENTATION_LOGO_MAX_HEIGHT_PX,
    logoMaxWidthPx: DEFAULT_PRESENTATION_LOGO_MAX_WIDTH_PX,
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
  layoutTheme: "standard",
};

export type PresentationShellConfigInput = Partial<Omit<PresentationShellConfig, "header">> & {
  header?: Partial<PresentationShellConfig["header"]>;
};

export function normalizePresentationShellConfig(
  raw: PresentationShellConfigInput | null | undefined
): PresentationShellConfig {
  const base = DEFAULT_PRESENTATION_SHELL_CONFIG;
  if (!raw || typeof raw !== "object") return base;

  return {
    version: 1,
    page: {
      size: raw.page?.size === "LETTER" ? "LETTER" : base.page.size,
      orientation: raw.page?.orientation === "landscape" ? "landscape" : base.page.orientation,
    },
    margins: normalizeSpacingValues(raw.margins, base.margins),
    padding: normalizeSpacingValues(raw.padding, base.padding),
    header: {
      showLogo: raw.header?.showLogo ?? base.header.showLogo,
      logoPlacement: normalizeLogoPlacement(raw.header?.logoPlacement),
      logoMaxHeightPx: normalizeLogoDimension(
        raw.header?.logoMaxHeightPx,
        base.header.logoMaxHeightPx,
        PRESENTATION_LOGO_HEIGHT_MIN_PX,
        PRESENTATION_LOGO_HEIGHT_MAX_PX
      ),
      logoMaxWidthPx: normalizeLogoDimension(
        raw.header?.logoMaxWidthPx,
        base.header.logoMaxWidthPx,
        PRESENTATION_LOGO_WIDTH_MIN_PX,
        PRESENTATION_LOGO_WIDTH_MAX_PX
      ),
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
    compliance: normalizeComplianceBlock(raw.compliance),
  };
}

function normalizeComplianceBlock(
  raw: PresentationShellConfig["compliance"] | undefined
): PresentationShellConfig["compliance"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  if (raw.pack !== "gst_tax_invoice" && raw.pack !== "standard") return undefined;

  return {
    pack: raw.pack,
    showPlaceOfSupply: raw.showPlaceOfSupply ?? raw.pack === "gst_tax_invoice",
    showIrnPlaceholder: raw.showIrnPlaceholder ?? raw.pack === "gst_tax_invoice",
    statutoryNote: typeof raw.statutoryNote === "string" ? raw.statutoryNote : "",
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
    layoutTheme: normalizePresentationLayoutTheme(raw.layoutTheme ?? base.layoutTheme),
  };
}
