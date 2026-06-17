import type { PresentationLayoutTheme, PresentationStyleConfig } from "@/lib/documents/print/types";

export const PRESENTATION_LAYOUT_THEMES: PresentationLayoutTheme[] = [
  "standard",
  "compact",
  "detailed",
  "minimal",
  "formal",
  "branded",
];

const PRESET_STYLE_BY_THEME: Record<PresentationLayoutTheme, PresentationStyleConfig> = {
  standard: {
    fontFamily: "system-ui, sans-serif",
    fontSizePx: 12,
    layoutTheme: "standard",
  },
  compact: {
    fontFamily: "system-ui, sans-serif",
    fontSizePx: 10,
    layoutTheme: "compact",
  },
  detailed: {
    fontFamily: "system-ui, sans-serif",
    fontSizePx: 12,
    layoutTheme: "detailed",
  },
  minimal: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSizePx: 11,
    layoutTheme: "minimal",
  },
  formal: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSizePx: 12,
    layoutTheme: "formal",
  },
  branded: {
    fontFamily: "system-ui, sans-serif",
    fontSizePx: 12,
    layoutTheme: "branded",
  },
};

export function presentationStyleForLayoutTheme(
  theme: PresentationLayoutTheme
): PresentationStyleConfig {
  return { ...PRESET_STYLE_BY_THEME[theme] };
}

export function normalizePresentationLayoutTheme(
  raw: string | null | undefined
): PresentationLayoutTheme {
  if (raw && PRESENTATION_LAYOUT_THEMES.includes(raw as PresentationLayoutTheme)) {
    return raw as PresentationLayoutTheme;
  }
  return "standard";
}

export function renderPresentationLayoutThemeCss(theme: PresentationLayoutTheme): string {
  switch (theme) {
    case "compact":
      return `
    body.theme-compact { padding: 14px; }
    body.theme-compact .doc-header { margin-bottom: 12px; gap: 16px; }
    body.theme-compact .doc-title { font-size: 16px; }
    body.theme-compact .header-grid { gap: 8px 16px; margin-bottom: 12px; }
    body.theme-compact .field .value { font-size: 11px; }
    body.theme-compact th, body.theme-compact td { padding: 3px 5px; }
    body.theme-compact .totals { margin-top: 10px; max-width: 300px; }
    body.theme-compact .terms { margin-top: 12px; }
      `.trim();
    case "detailed":
      return `
    body.theme-detailed .doc-header { margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #ddd; }
    body.theme-detailed .header-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 20px; margin-bottom: 24px; }
    body.theme-detailed table { border: 1px solid #ccc; margin-top: 12px; }
    body.theme-detailed th, body.theme-detailed td { border: 1px solid #ddd; padding: 7px 10px; }
    body.theme-detailed th { background: #f3f4f6; color: #374151; }
    body.theme-detailed .totals { border: 1px solid #ddd; padding: 10px 12px; background: #fafafa; }
    body.theme-detailed .terms { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; }
    body.theme-detailed .footer-legal { margin-top: 28px; }
      `.trim();
    case "minimal":
      return `
    body.theme-minimal { padding: 32px; color: #222; }
    body.theme-minimal .doc-header { display: block; margin-bottom: 28px; }
    body.theme-minimal .doc-title-block { text-align: left; margin-top: 16px; min-width: 0; }
    body.theme-minimal .doc-title { font-size: 18px; font-weight: 600; text-transform: none; letter-spacing: 0; }
    body.theme-minimal .brand-name { font-size: 15px; font-weight: 600; }
    body.theme-minimal .header-grid { grid-template-columns: 1fr; gap: 10px; margin-bottom: 28px; }
    body.theme-minimal .field .label { text-transform: none; letter-spacing: 0; font-size: 11px; color: #888; }
    body.theme-minimal .field .value { font-weight: 500; font-size: 12px; }
    body.theme-minimal th { text-transform: none; font-weight: 600; color: #555; border-bottom: 1px solid #ccc; }
    body.theme-minimal th, body.theme-minimal td { border-bottom: 1px solid #eee; border-top: none; border-left: none; border-right: none; padding: 8px 4px; }
    body.theme-minimal .totals { max-width: none; margin-left: 0; border-top: none; padding-top: 16px; }
    body.theme-minimal .footer-legal { border-top: none; color: #999; }
      `.trim();
    case "formal":
      return `
    body.theme-formal .doc-title { font-family: Georgia, 'Times New Roman', serif; letter-spacing: 0.08em; }
    body.theme-formal .brand-name { font-family: Georgia, 'Times New Roman', serif; }
    body.theme-formal th { border-bottom: 2px solid #111; color: #111; letter-spacing: 0.06em; }
    body.theme-formal th, body.theme-formal td { padding: 7px 10px; }
    body.theme-formal .totals { border: 1px solid #111; padding: 12px 14px; max-width: 380px; }
    body.theme-formal .total-row:last-child { font-weight: 700; border-top: 1px solid #111; margin-top: 4px; padding-top: 6px; }
    body.theme-formal .terms h2 { font-family: Georgia, 'Times New Roman', serif; letter-spacing: 0.06em; }
    body.theme-formal .footer-legal { border-top: 3px double #ccc; font-style: italic; }
      `.trim();
    case "branded":
      return `
    body.theme-branded .doc-header { border-bottom: 3px solid #2563eb; padding-bottom: 14px; margin-bottom: 22px; }
    body.theme-branded .brand-name { color: #1d4ed8; font-size: 18px; }
    body.theme-branded .brand-logo img { max-height: 56px; }
    body.theme-branded .doc-title { color: #1d4ed8; }
    body.theme-branded th { background: #2563eb; color: #fff; border-bottom: none; text-transform: none; letter-spacing: 0.02em; font-size: 11px; }
    body.theme-branded th, body.theme-branded td { padding: 7px 10px; }
    body.theme-branded tbody tr:nth-child(even) { background: #f8fafc; }
    body.theme-branded .totals { border-top: 2px solid #2563eb; padding-top: 10px; }
    body.theme-branded .total-row:last-child { color: #1d4ed8; font-weight: 700; }
    body.theme-branded .terms { background: #eff6ff; border-left: 3px solid #2563eb; padding: 10px 12px; margin-top: 22px; }
    body.theme-branded .terms h2 { color: #1d4ed8; }
      `.trim();
    default:
      return "";
  }
}
