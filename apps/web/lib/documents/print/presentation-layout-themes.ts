import type { PresentationLayoutTheme, PresentationStyleConfig } from "@/lib/documents/print/types";

export const PRESENTATION_LAYOUT_THEMES: PresentationLayoutTheme[] = [
  "trade",
  "classic",
  "modern",
  "industrial",
  "retail",
  "standard",
  "compact",
  "detailed",
  "minimal",
  "formal",
  "branded",
];

const PRESET_STYLE_BY_THEME: Record<PresentationLayoutTheme, PresentationStyleConfig> = {
  trade: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSizePx: 11,
    layoutTheme: "trade",
  },
  classic: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSizePx: 11,
    layoutTheme: "classic",
  },
  industrial: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSizePx: 10,
    layoutTheme: "industrial",
  },
  retail: {
    fontFamily: "system-ui, sans-serif",
    fontSizePx: 11,
    layoutTheme: "retail",
  },
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
    case "trade":
      return `
    body.theme-trade {
      --doc-border: #333;
      --doc-muted: #555;
      --doc-text: #111;
      color: var(--doc-text);
      padding: 16px 20px;
    }
    body.theme-trade .doc-header {
      align-items: flex-start;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--doc-border);
    }
    body.theme-trade .brand-name { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
    body.theme-trade .brand-address, body.theme-trade .brand-tax, body.theme-trade .brand-website {
      font-size: 10px; line-height: 1.5; color: var(--doc-muted); margin-top: 3px;
    }
    body.theme-trade .doc-title-block { min-width: 210px; text-align: right; }
    body.theme-trade .doc-title {
      font-size: 20px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--doc-text);
    }
    body.theme-trade .doc-number { display: none; }
    body.theme-trade .doc-status-badge { display: none; }
    body.theme-trade .title-meta { margin-top: 8px; }
    body.theme-trade .title-meta-row {
      display: grid; grid-template-columns: minmax(5.5rem, auto) 1fr; gap: 8px;
      padding: 2px 0; font-size: 10px; line-height: 1.4;
    }
    body.theme-trade .title-meta-label { color: var(--doc-muted); text-align: left; }
    body.theme-trade .title-meta-value { font-weight: 600; text-align: right; color: var(--doc-text); }
    body.theme-trade .header-grid { display: none; }
    body.theme-trade .party-blocks {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0;
      border: 1px solid var(--doc-border); margin-bottom: 14px;
    }
    body.theme-trade .party-block { padding: 10px 12px; min-height: 72px; }
    body.theme-trade .party-block + .party-block { border-left: 1px solid var(--doc-border); }
    body.theme-trade .party-block__title {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--doc-text); margin-bottom: 6px;
    }
    body.theme-trade .party-block__name { font-size: 11px; font-weight: 700; margin-bottom: 3px; }
    body.theme-trade .party-block__line { font-size: 10px; line-height: 1.45; color: #333; }
    body.theme-trade .party-block__tax { font-size: 10px; margin-top: 4px; color: var(--doc-muted); }
    body.theme-trade table { margin-top: 0; border: 1px solid var(--doc-border); border-collapse: collapse; }
    body.theme-trade th, body.theme-trade td { border: 1px solid var(--doc-border); padding: 6px 8px; font-size: 10px; }
    body.theme-trade th {
      background: #f5f5f5; color: var(--doc-text); font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.03em; font-size: 9px;
    }
    body.theme-trade .line-item-name { font-weight: 700; }
    body.theme-trade .line-detail { font-size: 9px; color: var(--doc-muted); margin-top: 4px; }
    body.theme-trade .totals {
      margin-top: 12px; max-width: 340px; margin-left: auto; border: none; padding-top: 0;
    }
    body.theme-trade .total-row { padding: 3px 0; font-size: 10px; border-bottom: none; }
    body.theme-trade .total-row:last-child { font-weight: 700; font-size: 11px; }
    body.theme-trade .total-row--words {
      display: block; margin-top: 6px; padding-top: 6px; border-top: 1px solid #ddd;
      font-size: 10px; font-style: italic; color: var(--doc-muted); line-height: 1.45;
    }
    body.theme-trade .total-row--words span { display: block; }
    body.theme-trade .closing-message {
      margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd;
      text-align: center; font-size: 10px; color: var(--doc-muted); line-height: 1.5; white-space: pre-line;
    }
    body.theme-trade .footer-legal { margin-top: 10px; font-size: 9px; color: #888; border-top: none; }
      `.trim();
    case "classic":
      return `
    body.theme-classic { padding: 20px 24px; color: #1a1a1a; }
    body.theme-classic .doc-header {
      margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #1a1a1a;
    }
    body.theme-classic .brand-name { font-family: Georgia, 'Times New Roman', serif; font-size: 17px; font-weight: 700; }
    body.theme-classic .brand-address, body.theme-classic .brand-tax { font-size: 10px; line-height: 1.5; color: #444; margin-top: 4px; }
    body.theme-classic .doc-title-block { text-align: right; min-width: 220px; }
    body.theme-classic .doc-title {
      font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 700;
      letter-spacing: 0.06em; text-transform: uppercase;
    }
    body.theme-classic .doc-number { display: none; }
    body.theme-classic .doc-status-badge { display: none; }
    body.theme-classic .title-meta { margin-top: 10px; border: 1px solid #ccc; padding: 6px 10px; }
    body.theme-classic .title-meta-row {
      display: grid; grid-template-columns: minmax(6rem, auto) 1fr; gap: 10px;
      padding: 3px 0; font-size: 10px;
    }
    body.theme-classic .title-meta-label { color: #666; }
    body.theme-classic .title-meta-value { font-weight: 600; text-align: right; }
    body.theme-classic .header-grid { display: none; }
    body.theme-classic .party-blocks {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0;
      border: 2px solid #1a1a1a; margin-bottom: 16px;
    }
    body.theme-classic .party-block { padding: 10px 12px; }
    body.theme-classic .party-block + .party-block { border-left: 2px solid #1a1a1a; }
    body.theme-classic .party-block__title {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 6px;
    }
    body.theme-classic .party-block__name { font-weight: 700; font-size: 11px; }
    body.theme-classic .party-block__line { font-size: 10px; line-height: 1.45; }
    body.theme-classic table { border: 2px solid #1a1a1a; margin-top: 0; }
    body.theme-classic th, body.theme-classic td { border: 1px solid #999; padding: 6px 8px; font-size: 10px; }
    body.theme-classic th { background: #f0f0f0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    body.theme-classic .totals {
      margin-top: 14px; max-width: 380px; margin-left: auto;
      border: 2px solid #1a1a1a; padding: 8px 12px;
    }
    body.theme-classic .total-row { font-size: 10px; padding: 3px 0; }
    body.theme-classic .total-row:last-child { font-weight: 700; border-top: 1px solid #1a1a1a; margin-top: 4px; padding-top: 6px; }
    body.theme-classic .total-row--words { display: block; margin-top: 6px; font-style: italic; font-size: 10px; color: #555; }
    body.theme-classic .footer-legal { margin-top: 20px; border-top: 3px double #ccc; font-style: italic; font-size: 9px; }
      `.trim();
    case "industrial":
      return `
    body.theme-industrial {
      --doc-accent: #374151;
      --doc-border: #9ca3af;
      --doc-muted: #6b7280;
      padding: 14px 18px;
    }
    body.theme-industrial .doc-header {
      margin-bottom: 12px; padding: 8px 10px; background: #f3f4f6;
      border: 1px solid var(--doc-border); border-left: 4px solid var(--doc-accent);
    }
    body.theme-industrial .brand-name { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
    body.theme-industrial .brand-address, body.theme-industrial .brand-tax { font-size: 9px; color: var(--doc-muted); }
    body.theme-industrial .doc-title { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--doc-accent); }
    body.theme-industrial .doc-number { font-size: 12px; font-weight: 700; font-family: ui-monospace, monospace; }
    body.theme-industrial .header-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 16px; margin-bottom: 14px;
      padding: 8px 10px; background: #fafafa; border: 1px solid #e5e7eb;
    }
    body.theme-industrial .field .label { font-size: 8px; font-weight: 700; color: var(--doc-muted); }
    body.theme-industrial .field .value { font-size: 11px; font-family: ui-monospace, monospace; }
    body.theme-industrial .party-blocks { display: none; }
    body.theme-industrial table { border: 1px solid var(--doc-border); }
    body.theme-industrial th { background: var(--doc-accent); color: #fff; font-size: 8px; font-weight: 700; letter-spacing: 0.06em; border-bottom: none; padding: 5px 7px; }
    body.theme-industrial td { font-size: 10px; padding: 5px 7px; font-family: ui-monospace, monospace; border-bottom: 1px solid #e5e7eb; }
    body.theme-industrial tbody tr:nth-child(even) { background: #f9fafb; }
    body.theme-industrial .totals { max-width: 300px; border-top: 2px solid var(--doc-accent); padding-top: 6px; }
    body.theme-industrial .total-row { font-size: 10px; font-family: ui-monospace, monospace; }
    body.theme-industrial .total-row:last-child { font-weight: 800; }
      `.trim();
    case "retail":
      return `
    body.theme-retail { padding: 24px 28px; color: #222; }
    body.theme-retail .doc-header { margin-bottom: 20px; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
    body.theme-retail .letterhead { flex: none; width: 100%; }
    body.theme-retail .letterhead--top, body.theme-retail .letterhead--left { align-items: center; justify-content: center; flex-direction: column; }
    body.theme-retail .brand-name { font-size: 20px; font-weight: 600; letter-spacing: 0.02em; }
    body.theme-retail .brand-address, body.theme-retail .brand-tax { font-size: 10px; color: #777; }
    body.theme-retail .doc-title-block { text-align: center; min-width: 0; width: 100%; margin-top: 8px; }
    body.theme-retail .doc-title { font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.12em; color: #888; }
    body.theme-retail .doc-number { display: none; }
    body.theme-retail .title-meta {
      display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 20px; margin-top: 8px;
    }
    body.theme-retail .title-meta-row { font-size: 10px; }
    body.theme-retail .title-meta-label { color: #999; margin-right: 4px; }
    body.theme-retail .title-meta-value { font-weight: 600; }
    body.theme-retail .header-grid { display: none; }
    body.theme-retail .party-blocks { display: none; }
    body.theme-retail th, body.theme-retail td { border-bottom: 1px solid #eee; padding: 8px 6px; font-size: 10px; }
    body.theme-retail th { text-transform: none; font-weight: 600; color: #888; font-size: 9px; letter-spacing: 0.04em; }
    body.theme-retail .totals { max-width: none; margin-left: 0; border-top: 1px dashed #ddd; padding-top: 12px; text-align: center; }
    body.theme-retail .total-row { justify-content: center; gap: 16px; font-size: 11px; }
    body.theme-retail .total-row:last-child { font-size: 14px; font-weight: 700; margin-top: 4px; }
    body.theme-retail .closing-message { margin-top: 24px; text-align: center; font-size: 11px; color: #888; white-space: pre-line; }
      `.trim();
    default:
      return "";
  }
}
