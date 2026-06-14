import { normalizeDocumentLayoutTemplate } from "@/lib/documents/normalize-document-layout";
import type {
  DocumentColumnPref,
  DocumentImageDisplayMode,
  DocumentLayoutTemplate,
  DocumentModuleKey,
  DocumentViewContext,
} from "@/lib/documents/types";

const FORMATTING_VERSION = 1;

export type DocumentLayoutFormattingMeta = {
  version: typeof FORMATTING_VERSION;
  lineColumnOrder: string[];
  catalogLineFieldOrder: string[];
  headerFieldOrder: string[];
  totalsFieldOrder: string[];
};

export type DocumentLayoutTemplateRow = {
  module_key: string;
  view_context: string;
  image_display_mode: string;
  grid_columns_json: unknown;
  line_item_formatting: unknown;
};

const IMAGE_DISPLAY_MODES = new Set<DocumentImageDisplayMode>([
  "INLINE_CELL",
  "SEPARATE_COLUMN",
  "HIDDEN",
]);

function parseStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((entry): entry is string => typeof entry === "string");
}

function parseColumnPref(raw: unknown): DocumentColumnPref | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.label !== "string") return null;
  if (typeof record.defaultVisible !== "boolean") return null;

  const column: DocumentColumnPref = {
    id: record.id,
    label: record.label,
    defaultVisible: record.defaultVisible,
  };

  if (typeof record.showLabel === "boolean") column.showLabel = record.showLabel;
  if (record.group === "line" || record.group === "header" || record.group === "totals" || record.group === "catalog") {
    column.group = record.group;
  }
  if (record.align === "left" || record.align === "right" || record.align === "center") {
    column.align = record.align;
  }
  if (typeof record.decimalPlaces === "number") column.decimalPlaces = record.decimalPlaces;
  if (record.lineSlot === "column" || record.lineSlot === "item_detail") {
    column.lineSlot = record.lineSlot;
  }
  if (record.itemDetailFlow === "new_line" || record.itemDetailFlow === "inline_previous") {
    column.itemDetailFlow = record.itemDetailFlow;
  }
  if (
    record.catalogSource === "item_column" ||
    record.catalogSource === "item_custom_field" ||
    record.catalogSource === "variant_attribute" ||
    record.catalogSource === "variant_attributes_all"
  ) {
    column.catalogSource = record.catalogSource;
  }
  if (typeof record.catalogSourceKey === "string") {
    column.catalogSourceKey = record.catalogSourceKey;
  }
  if (record.typography && typeof record.typography === "object") {
    const typography = record.typography as Record<string, unknown>;
    column.typography = {
      fontSize:
        typography.fontSize === "xs" ||
        typography.fontSize === "sm" ||
        typography.fontSize === "base" ||
        typography.fontSize === "lg"
          ? typography.fontSize
          : undefined,
      fontWeight:
        typography.fontWeight === "normal" ||
        typography.fontWeight === "semibold" ||
        typography.fontWeight === "bold"
          ? typography.fontWeight
          : undefined,
      fontStyle:
        typography.fontStyle === "normal" || typography.fontStyle === "italic"
          ? typography.fontStyle
          : undefined,
    };
    if (
      !column.typography.fontSize &&
      !column.typography.fontWeight &&
      !column.typography.fontStyle
    ) {
      delete column.typography;
    }
  }

  return column;
}

function parseColumnPrefs(raw: unknown): DocumentColumnPref[] | null {
  if (!Array.isArray(raw)) return null;
  const columns = raw.map(parseColumnPref).filter((column): column is DocumentColumnPref => !!column);
  return columns.length > 0 ? columns : null;
}

function parseFormattingMeta(raw: unknown): Partial<DocumentLayoutFormattingMeta> | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== FORMATTING_VERSION) return null;

  return {
    version: FORMATTING_VERSION,
    lineColumnOrder: parseStringArray(record.lineColumnOrder),
    catalogLineFieldOrder: parseStringArray(record.catalogLineFieldOrder),
    headerFieldOrder: parseStringArray(record.headerFieldOrder),
    totalsFieldOrder: parseStringArray(record.totalsFieldOrder),
  };
}

function parseImageDisplayMode(raw: unknown): DocumentImageDisplayMode | undefined {
  if (typeof raw !== "string") return undefined;
  return IMAGE_DISPLAY_MODES.has(raw as DocumentImageDisplayMode)
    ? (raw as DocumentImageDisplayMode)
    : undefined;
}

export function serializeDocumentLayoutTemplate(layout: DocumentLayoutTemplate) {
  const formatting: DocumentLayoutFormattingMeta = {
    version: FORMATTING_VERSION,
    lineColumnOrder: [...layout.lineColumnOrder],
    catalogLineFieldOrder: [...layout.catalogLineFieldOrder],
    headerFieldOrder: [...layout.headerFieldOrder],
    totalsFieldOrder: [...layout.totalsFieldOrder],
  };

  return {
    module_key: layout.moduleKey,
    view_context: layout.viewContext,
    image_display_mode: layout.imageDisplayMode,
    grid_columns_json: layout.columns,
    line_item_formatting: formatting,
  };
}

export function documentLayoutFromRow(
  row: DocumentLayoutTemplateRow | null | undefined,
  moduleKey: DocumentModuleKey,
  viewContext: DocumentViewContext
): DocumentLayoutTemplate {
  if (!row) {
    return normalizeDocumentLayoutTemplate(moduleKey, { moduleKey, viewContext });
  }

  const columns = parseColumnPrefs(row.grid_columns_json);
  const formatting = parseFormattingMeta(row.line_item_formatting);

  return normalizeDocumentLayoutTemplate(moduleKey, {
    moduleKey,
    viewContext,
    columns: columns ?? undefined,
    lineColumnOrder: formatting?.lineColumnOrder,
    catalogLineFieldOrder: formatting?.catalogLineFieldOrder,
    headerFieldOrder: formatting?.headerFieldOrder,
    totalsFieldOrder: formatting?.totalsFieldOrder,
    imageDisplayMode: parseImageDisplayMode(row.image_display_mode),
  });
}
