import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import {
  DEFAULT_PRESENTATION_SHELL_CONFIG,
  DEFAULT_PRESENTATION_STYLE_CONFIG,
  normalizePresentationShellConfig,
  normalizePresentationStyleConfig,
} from "@/lib/documents/print/default-shell-config";
import {
  presentationStyleForLayoutTheme,
  PRESENTATION_LAYOUT_THEMES,
} from "@/lib/documents/print/presentation-layout-themes";
import type {
  PresentationLayoutTheme,
  PresentationShellConfig,
  PresentationStyleConfig,
} from "@/lib/documents/print/types";
import type { DocumentColumnPref, DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";

export type DesignerLayoutPreset = {
  id: string;
  label: string;
  description: string;
};

export type DesignerLayoutBundle = {
  layout: DocumentLayoutTemplate;
  shellConfig: PresentationShellConfig;
  styleConfig: PresentationStyleConfig;
};

const NUMERIC_COLUMN_PATTERN =
  /quantity|qty|price|amount|total|tax|discount|rate|decimal|gross|net|billed|ordered|received|invoiced/i;

const OPTIONAL_HEADER_FIELDS = new Set([
  "internal_notes",
  "requisition_number",
  "expected_delivery_date",
  "payment_terms_days",
  "created_by",
  "updated_at",
  "document_status",
]);

const TERMS_SNIPPETS = [
  "Payment due within agreed credit terms. Late payments may attract interest.",
  "Goods remain the property of the seller until paid in full.",
  "Please quote the document number on all correspondence and remittances.",
  "Prices are exclusive of taxes unless stated otherwise.",
  "Delivery dates are estimates and subject to stock availability.",
];

const LEGAL_SNIPPETS = [
  "This is a computer-generated document and does not require a signature.",
  "Registered office address applies for statutory correspondence.",
  "Subject to applicable local tax and commercial laws.",
];

export const DOCUMENT_DESIGNER_LAYOUT_PRESETS: DesignerLayoutPreset[] = [
  { id: "standard", label: "Standard", description: "Balanced default for print and email." },
  { id: "compact", label: "Compact", description: "Dense type, tight margins, fewer header fields." },
  { id: "detailed", label: "Detailed", description: "Full grid borders, three-column metadata, terms block." },
  { id: "minimal", label: "Minimal", description: "Serif type, open spacing, essentials only." },
  { id: "formal", label: "Formal", description: "Serif letterhead, boxed totals, legal footer." },
  { id: "branded", label: "Branded", description: "Accent header band, shaded table, promotional terms." },
];

function cloneLayout(layout: DocumentLayoutTemplate): DocumentLayoutTemplate {
  return structuredClone(layout);
}

function cloneShell(shell: PresentationShellConfig): PresentationShellConfig {
  return structuredClone(shell);
}

function withPresetStyle(
  bundle: DesignerLayoutBundle,
  presetId: PresentationLayoutTheme
): PresentationStyleConfig {
  return presentationStyleForLayoutTheme(presetId);
}

function patchColumns(
  layout: DocumentLayoutTemplate,
  patches: Array<{ id: string; patch: Partial<DocumentColumnPref> }>
): DocumentLayoutTemplate {
  const adapter = DOCUMENT_LAYOUT_MODULE_ADAPTERS[layout.moduleKey];
  return patches.reduce(
    (current, entry) => adapter.patchColumn(current, entry.id, entry.patch),
    layout
  );
}

function patchColumnIds(
  layout: DocumentLayoutTemplate,
  ids: string[],
  patch: Partial<DocumentColumnPref>
): DocumentLayoutTemplate {
  return patchColumns(
    layout,
    ids.map((id) => ({ id, patch }))
  );
}

function allColumnIds(layout: DocumentLayoutTemplate): string[] {
  return layout.columns.map((column) => column.id);
}

function numericColumnIds(layout: DocumentLayoutTemplate): string[] {
  return layout.columns
    .filter((column) => NUMERIC_COLUMN_PATTERN.test(column.id))
    .map((column) => column.id);
}

function optionalHeaderIds(layout: DocumentLayoutTemplate): string[] {
  return layout.headerFieldOrder.filter((id) => OPTIONAL_HEADER_FIELDS.has(id));
}

function optionalLineIds(layout: DocumentLayoutTemplate): string[] {
  return layout.lineColumnOrder.filter(
    (id) => id !== "item" && !NUMERIC_COLUMN_PATTERN.test(id) && id !== "sku" && id !== "unit"
  );
}

function applyStandard(bundle: DesignerLayoutBundle): DesignerLayoutBundle {
  return {
    layout: cloneLayout(bundle.layout),
    shellConfig: normalizePresentationShellConfig(cloneShell(bundle.shellConfig)),
    styleConfig: withPresetStyle(bundle, "standard"),
  };
}

function applyCompact(bundle: DesignerLayoutBundle): DesignerLayoutBundle {
  const layout = patchColumnIds(bundle.layout, optionalHeaderIds(bundle.layout), {
    defaultVisible: false,
  });
  const trimmedLines = patchColumnIds(layout, optionalLineIds(layout).slice(0, 2), {
    defaultVisible: false,
  });

  return {
    layout: trimmedLines,
    shellConfig: normalizePresentationShellConfig({
      ...bundle.shellConfig,
      margins: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
      header: {
        ...bundle.shellConfig.header,
        showOrgAddress: false,
      },
      sections: {
        ...bundle.shellConfig.sections,
        showTerms: false,
        termsText: "",
      },
      footer: {
        ...bundle.shellConfig.footer,
        legalText: "",
      },
    }),
    styleConfig: withPresetStyle(bundle, "compact"),
  };
}

function applyDetailed(bundle: DesignerLayoutBundle): DesignerLayoutBundle {
  const layout = patchColumnIds(bundle.layout, allColumnIds(bundle.layout), {
    defaultVisible: true,
  });

  return {
    layout,
    shellConfig: normalizePresentationShellConfig({
      ...bundle.shellConfig,
      header: {
        ...bundle.shellConfig.header,
        showLogo: true,
        showOrgName: true,
        showOrgAddress: true,
        showDocumentTitle: true,
      },
      sections: {
        showHeaderFields: true,
        showLineTable: true,
        showTotals: true,
        showTerms: true,
        termsText:
          bundle.shellConfig.sections.termsText.trim() ||
          "Please review all line items and totals. Contact us for discrepancies within 7 days.",
      },
      footer: {
        showPageNumbers: false,
        legalText:
          bundle.shellConfig.footer.legalText.trim() ||
          "This document is generated electronically and is valid without signature.",
      },
    }),
    styleConfig: withPresetStyle(bundle, "detailed"),
  };
}

function applyMinimal(bundle: DesignerLayoutBundle): DesignerLayoutBundle {
  const layout = patchColumnIds(bundle.layout, optionalHeaderIds(bundle.layout), {
    defaultVisible: false,
  });
  const trimmed = patchColumnIds(layout, optionalLineIds(layout), { defaultVisible: false });

  return {
    layout: trimmed,
    shellConfig: normalizePresentationShellConfig({
      ...bundle.shellConfig,
      margins: { top: "10mm", bottom: "10mm", left: "12mm", right: "12mm" },
      header: {
        ...bundle.shellConfig.header,
        showLogo: false,
        showOrgAddress: false,
      },
      sections: {
        showHeaderFields: true,
        showLineTable: true,
        showTotals: true,
        showTerms: false,
        termsText: "",
      },
      footer: {
        showPageNumbers: false,
        legalText: "",
      },
    }),
    styleConfig: withPresetStyle(bundle, "minimal"),
  };
}

function applyFormal(bundle: DesignerLayoutBundle): DesignerLayoutBundle {
  const numericIds = numericColumnIds(bundle.layout);
  let layout = patchColumnIds(bundle.layout, numericIds, { align: "right" });
  layout = patchColumnIds(layout, ["item"], {
    typography: { fontWeight: "semibold" },
  });

  return {
    layout,
    shellConfig: normalizePresentationShellConfig({
      ...bundle.shellConfig,
      header: {
        ...bundle.shellConfig.header,
        showLogo: true,
        showOrgName: true,
        showOrgAddress: true,
        showDocumentTitle: true,
      },
      sections: {
        showHeaderFields: true,
        showLineTable: true,
        showTotals: true,
        showTerms: true,
        termsText:
          bundle.shellConfig.sections.termsText.trim() ||
          "Payment terms apply as per the commercial agreement between parties.",
      },
      footer: {
        showPageNumbers: true,
        legalText:
          bundle.shellConfig.footer.legalText.trim() ||
          "Confidential commercial document. Unauthorized reproduction is prohibited.",
      },
    }),
    styleConfig: withPresetStyle(bundle, "formal"),
  };
}

function applyBranded(bundle: DesignerLayoutBundle): DesignerLayoutBundle {
  return {
    layout: cloneLayout(bundle.layout),
    shellConfig: normalizePresentationShellConfig({
      ...bundle.shellConfig,
      margins: { top: "14mm", bottom: "12mm", left: "10mm", right: "10mm" },
      header: {
        ...bundle.shellConfig.header,
        showLogo: true,
        showOrgName: true,
        showOrgAddress: true,
        showDocumentTitle: true,
      },
      sections: {
        showHeaderFields: true,
        showLineTable: true,
        showTotals: true,
        showTerms: true,
        termsText:
          bundle.shellConfig.sections.termsText.trim() ||
          "Thank you for your business. We appreciate your partnership.",
      },
      footer: {
        showPageNumbers: false,
        legalText: bundle.shellConfig.footer.legalText,
      },
    }),
    styleConfig: withPresetStyle(bundle, "branded"),
  };
}

const PRESET_APPLIERS: Record<string, (bundle: DesignerLayoutBundle) => DesignerLayoutBundle> = {
  standard: applyStandard,
  compact: applyCompact,
  detailed: applyDetailed,
  minimal: applyMinimal,
  formal: applyFormal,
  branded: applyBranded,
};

export function normalizeDesignerBundle(
  moduleKey: DocumentModuleKey,
  viewContext: DocumentLayoutTemplate["viewContext"],
  layout: DocumentLayoutTemplate,
  shellConfig: PresentationShellConfig,
  styleConfig: PresentationStyleConfig = DEFAULT_PRESENTATION_STYLE_CONFIG
): DesignerLayoutBundle {
  const adapter = DOCUMENT_LAYOUT_MODULE_ADAPTERS[moduleKey];
  return {
    layout: adapter.normalize({
      ...layout,
      moduleKey,
      viewContext,
    }),
    shellConfig: normalizePresentationShellConfig(shellConfig),
    styleConfig: normalizePresentationStyleConfig(styleConfig),
  };
}

export function applyDesignerLayoutPreset(
  presetId: string,
  bundle: DesignerLayoutBundle
): DesignerLayoutBundle {
  const apply = PRESET_APPLIERS[presetId] ?? applyStandard;
  return apply(bundle);
}

export function cycleDesignerLayoutPreset(
  currentPresetId: string,
  direction: -1 | 1
): DesignerLayoutPreset {
  const index = DOCUMENT_DESIGNER_LAYOUT_PRESETS.findIndex((row) => row.id === currentPresetId);
  const safeIndex = index >= 0 ? index : 0;
  const nextIndex =
    (safeIndex + direction + DOCUMENT_DESIGNER_LAYOUT_PRESETS.length) %
    DOCUMENT_DESIGNER_LAYOUT_PRESETS.length;
  return DOCUMENT_DESIGNER_LAYOUT_PRESETS[nextIndex]!;
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function pickRandomSubset<T>(items: readonly T[], min: number, max: number): T[] {
  const count = Math.min(items.length, min + Math.floor(Math.random() * (max - min + 1)));
  const pool = [...items];
  const selected: T[] = [];
  while (selected.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(index, 1)[0]!);
  }
  return selected;
}

export function generateDesignerLayout(bundle: DesignerLayoutBundle): DesignerLayoutBundle {
  const marginSets = [
    { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    { top: "10mm", bottom: "16mm", left: "10mm", right: "10mm" },
  ] as const;

  const showTerms = Math.random() > 0.35;
  const showLegal = Math.random() > 0.4;
  const hideHeaders = pickRandomSubset(optionalHeaderIds(bundle.layout), 0, 3);
  const hideLines = pickRandomSubset(optionalLineIds(bundle.layout), 0, 4);
  const emphasizeNumeric = Math.random() > 0.5;

  let layout = bundle.layout;
  layout = patchColumnIds(
    layout,
    hideHeaders,
    { defaultVisible: false }
  );
  layout = patchColumnIds(
    layout,
    hideLines,
    { defaultVisible: false }
  );

  if (emphasizeNumeric) {
    layout = patchColumnIds(layout, numericColumnIds(layout), { align: "right" });
  }

  const visibleLineIds = layout.lineColumnOrder.filter((id) => {
    const column = layout.columns.find((row) => row.id === id);
    return column?.defaultVisible !== false;
  });
  if (visibleLineIds.length > 1 && Math.random() > 0.5) {
    const shuffled = [...visibleLineIds];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
    }
    layout = {
      ...layout,
      lineColumnOrder: shuffled,
    };
  }

  return {
    layout,
    shellConfig: normalizePresentationShellConfig({
      ...DEFAULT_PRESENTATION_SHELL_CONFIG,
      ...bundle.shellConfig,
      page: {
        size: Math.random() > 0.85 ? "LETTER" : "A4",
        orientation: "portrait",
      },
      margins: pickRandom(marginSets),
      header: {
        showLogo: Math.random() > 0.2,
        showOrgName: Math.random() > 0.1,
        showOrgAddress: Math.random() > 0.35,
        showDocumentTitle: true,
        titleOverride: bundle.shellConfig.header.titleOverride,
      },
      footer: {
        showPageNumbers: Math.random() > 0.7,
        legalText: showLegal ? pickRandom(LEGAL_SNIPPETS) : "",
      },
      sections: {
        showHeaderFields: Math.random() > 0.05,
        showLineTable: true,
        showTotals: Math.random() > 0.1,
        showTerms,
        termsText: showTerms ? pickRandom(TERMS_SNIPPETS) : "",
      },
      compliance: bundle.shellConfig.compliance,
    }),
    styleConfig: presentationStyleForLayoutTheme(
      pickRandom(PRESENTATION_LAYOUT_THEMES)
    ),
  };
}
