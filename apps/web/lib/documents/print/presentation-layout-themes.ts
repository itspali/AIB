import type { PresentationLayoutTheme, PresentationStyleConfig } from "@/lib/documents/print/types";

export const PRESENTATION_LAYOUT_THEMES: PresentationLayoutTheme[] = [
  "standard",
  "compact",
  "detailed",
  "minimal",
  "formal",
  "branded",
  "modern",
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
  modern: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSizePx: 11,
    layoutTheme: "modern",
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
    case "modern":
      return `
    body.theme-modern {
      --doc-accent: #475569;
      --doc-accent-soft: #f1f5f9;
      --doc-border: #cbd5e1;
      --doc-muted: #64748b;
      --doc-text: #0f172a;
      color: var(--doc-text);
      padding: 18px 20px;
    }
    body.theme-modern .doc-header {
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--doc-border);
    }
    body.theme-modern .brand-logo img { max-height: 52px; max-width: 160px; margin-bottom: 6px; }
    body.theme-modern .brand-name { font-size: 15px; font-weight: 700; color: var(--doc-text); }
    body.theme-modern .brand-address, body.theme-modern .brand-tax, body.theme-modern .brand-website {
      font-size: 10px; line-height: 1.5; color: var(--doc-muted); margin-top: 3px;
    }
    body.theme-modern .doc-title-block { min-width: 200px; }
    body.theme-modern .doc-title {
      font-size: 22px; font-weight: 700; color: #94a3b8; letter-spacing: 0.06em;
    }
    body.theme-modern .doc-number { font-size: 14px; font-weight: 700; color: var(--doc-text); margin-top: 4px; }
    body.theme-modern .doc-status-badge {
      display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 999px;
      background: var(--doc-accent-soft); border: 1px solid var(--doc-border);
      font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--doc-muted);
    }
    body.theme-modern .metadata-panel {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0;
      border: 1px solid var(--doc-border); border-radius: 4px; overflow: hidden; margin-bottom: 16px;
    }
    body.theme-modern .meta-row {
      display: grid; grid-template-columns: minmax(7rem, 42%) 1fr; gap: 8px;
      padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px;
    }
    body.theme-modern .meta-row:nth-child(odd) { background: #fafafa; }
    body.theme-modern .meta-label { color: var(--doc-muted); font-weight: 500; }
    body.theme-modern .meta-value { font-weight: 600; color: var(--doc-text); text-align: right; }
    body.theme-modern .party-blocks {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0;
      border: 1px solid var(--doc-border); border-radius: 4px; overflow: hidden; margin-bottom: 16px;
    }
    body.theme-modern .party-block { padding: 10px 12px; min-height: 88px; }
    body.theme-modern .party-block + .party-block { border-left: 1px solid var(--doc-border); }
    body.theme-modern .party-block__title {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--doc-muted); margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0;
    }
    body.theme-modern .party-block__name { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
    body.theme-modern .party-block__line { font-size: 10px; line-height: 1.45; color: #334155; }
    body.theme-modern .party-block__tax { font-size: 10px; margin-top: 4px; color: var(--doc-muted); }
    body.theme-modern table { margin-top: 0; border: 1px solid var(--doc-border); border-radius: 4px; overflow: hidden; }
    body.theme-modern th {
      background: #e2e8f0; color: #334155; border-bottom: 1px solid var(--doc-border);
      font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 7px 8px;
    }
    body.theme-modern td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; font-size: 10px; vertical-align: top; }
    body.theme-modern tbody tr:last-child td { border-bottom: none; }
    body.theme-modern .line-item-name { font-size: 10px; font-weight: 700; color: var(--doc-text); }
    body.theme-modern .line-detail {
      margin-top: 5px; padding-top: 5px; border-top: 1px dashed #e2e8f0; font-size: 9px; color: var(--doc-muted);
    }
    body.theme-modern .line-detail__label { font-weight: 600; color: #64748b; }
    body.theme-modern .line-detail__value { color: #334155; }
    body.theme-modern .line-detail__sep { color: #cbd5e1; }
    body.theme-modern .line-qty-unit { font-size: 8px; color: #64748b; }
    body.theme-modern .totals {
      margin-top: 14px; max-width: 320px; border: 1px solid var(--doc-border); border-radius: 4px;
      padding: 0; overflow: hidden; background: #fff;
    }
    body.theme-modern .total-row {
      display: grid; grid-template-columns: 1fr auto; gap: 12px; padding: 6px 10px;
      border-bottom: 1px solid #e2e8f0; font-size: 10px;
    }
    body.theme-modern .total-row:last-child {
      border-bottom: none; background: var(--doc-accent-soft); font-weight: 700; font-size: 11px;
    }
    body.theme-modern .terms {
      margin-top: 18px; padding: 10px 12px; border: 1px solid var(--doc-border); border-radius: 4px;
      background: #fafafa; font-size: 10px;
    }
    body.theme-modern .terms h2 { font-size: 10px; margin-bottom: 4px; color: var(--doc-muted); }
    body.theme-modern .footer-legal {
      margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--doc-border); font-size: 9px; color: var(--doc-muted);
    }
      `.trim();
    default:
      return "";
  }
}
