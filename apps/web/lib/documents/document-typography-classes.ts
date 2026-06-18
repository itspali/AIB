import type { DocumentColumnPref, DocumentTypography } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

export const DOCUMENT_TYPOGRAPHY_DEFAULT = "__default__" as const;

export type DocumentTypographyRole = "label" | "value";

type ColumnTypographySource = Pick<
  DocumentColumnPref,
  "typography" | "labelTypography" | "valueTypography"
>;

const FONT_SIZE_PX: Record<NonNullable<DocumentTypography["fontSize"]>, string> = {
  xs: "10px",
  sm: "11px",
  base: "12px",
  lg: "14px",
};

const FONT_WEIGHT_VALUE: Record<NonNullable<DocumentTypography["fontWeight"]>, string> = {
  normal: "400",
  semibold: "600",
  bold: "700",
};
const FONT_SIZE_CLASS: Record<NonNullable<DocumentTypography["fontSize"]>, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
};

const FONT_WEIGHT_CLASS: Record<NonNullable<DocumentTypography["fontWeight"]>, string> = {
  normal: "font-normal",
  semibold: "font-semibold",
  bold: "font-bold",
};

const FONT_STYLE_CLASS: Record<NonNullable<DocumentTypography["fontStyle"]>, string> = {
  normal: "not-italic",
  italic: "italic",
};

function parseDocumentTypography(raw: unknown): DocumentTypography | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const typography = raw as Record<string, unknown>;
  const next: DocumentTypography = {
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
  if (!next.fontSize && !next.fontWeight && !next.fontStyle) return undefined;
  return next;
}

function isEmptyTypography(typography: DocumentTypography | undefined): boolean {
  return !typography?.fontSize && !typography?.fontWeight && !typography?.fontStyle;
}

/** Migrate legacy single typography to split label/value prefs (preserves prior appearance). */
export function normalizeDocumentColumnTypography(column: DocumentColumnPref): DocumentColumnPref {
  const legacy = column.typography;
  if (!legacy) {
    const next = { ...column };
    if (isEmptyTypography(next.labelTypography)) delete next.labelTypography;
    if (isEmptyTypography(next.valueTypography)) delete next.valueTypography;
    delete next.typography;
    return next;
  }

  const next: DocumentColumnPref = { ...column };
  if (!next.labelTypography) next.labelTypography = { ...legacy };
  if (!next.valueTypography) next.valueTypography = { ...legacy };
  delete next.typography;
  if (isEmptyTypography(next.labelTypography)) delete next.labelTypography;
  if (isEmptyTypography(next.valueTypography)) delete next.valueTypography;
  return next;
}

export function parseDocumentColumnTypographyFields(record: Record<string, unknown>): {
  labelTypography?: DocumentTypography;
  valueTypography?: DocumentTypography;
  typography?: DocumentTypography;
} {
  const legacy = parseDocumentTypography(record.typography);
  const labelTypography = parseDocumentTypography(record.labelTypography) ?? legacy;
  const valueTypography = parseDocumentTypography(record.valueTypography) ?? legacy;
  return {
    labelTypography,
    valueTypography,
    typography: legacy,
  };
}

export function resolveColumnTypography(
  column: ColumnTypographySource | undefined,
  role: DocumentTypographyRole
): DocumentTypography | undefined {
  if (!column) return undefined;
  if (role === "label") {
    return column.labelTypography ?? column.typography;
  }
  return column.valueTypography ?? column.typography;
}

export function patchDocumentTypography(
  current: DocumentTypography | undefined,
  key: keyof DocumentTypography,
  value: string
): DocumentTypography | undefined {
  if (value === DOCUMENT_TYPOGRAPHY_DEFAULT) {
    if (!current) return undefined;
    const next = { ...current };
    delete next[key];
    return Object.keys(next).length > 0 ? next : undefined;
  }

  return {
    ...current,
    [key]: value as DocumentTypography[typeof key],
  };
}

export function patchColumnTypographyRole(
  column: ColumnTypographySource,
  role: DocumentTypographyRole,
  key: keyof DocumentTypography,
  value: string
): Partial<DocumentColumnPref> {
  const typographyKey = role === "label" ? "labelTypography" : "valueTypography";
  const current = resolveColumnTypography(column, role);
  return {
    [typographyKey]: patchDocumentTypography(current, key, value),
    typography: undefined,
  };
}

/** Tailwind classes for a document column's optional typography pref. */
export function documentTypographyClassName(
  typography: DocumentTypography | undefined,
  className?: string
): string {
  if (!typography) return className ?? "";

  return cn(
    className,
    typography.fontSize ? FONT_SIZE_CLASS[typography.fontSize] : null,
    typography.fontWeight ? FONT_WEIGHT_CLASS[typography.fontWeight] : null,
    typography.fontStyle ? FONT_STYLE_CLASS[typography.fontStyle] : null
  );
}

export function documentFieldLabelTypographyClassName(
  column: ColumnTypographySource | undefined,
  defaultClassName: string
): string {
  return documentTypographyClassName(resolveColumnTypography(column, "label"), defaultClassName);
}

export function documentFieldValueTypographyClassName(
  column: ColumnTypographySource | undefined,
  defaultClassName: string
): string {
  return documentTypographyClassName(resolveColumnTypography(column, "value"), defaultClassName);
}

/** @deprecated Use documentFieldLabelTypographyClassName or documentFieldValueTypographyClassName. */
export function documentFieldTypographyClassName(
  column: ColumnTypographySource | undefined,
  defaultClassName: string
): string {
  return documentFieldLabelTypographyClassName(column, defaultClassName);
}

export function typographySelectValue<T extends string>(
  value: T | undefined,
  fallback = DOCUMENT_TYPOGRAPHY_DEFAULT
): string {
  return value ?? fallback;
}

/** Inline CSS for print/PDF HTML from document typography prefs. */
export function documentTypographyInlineStyle(typography: DocumentTypography | undefined): string {
  if (!typography) return "";

  const parts: string[] = [];
  if (typography.fontSize) {
    parts.push(`font-size:${FONT_SIZE_PX[typography.fontSize]}`);
  }
  if (typography.fontWeight) {
    parts.push(`font-weight:${FONT_WEIGHT_VALUE[typography.fontWeight]}`);
  }
  if (typography.fontStyle === "italic") {
    parts.push("font-style:italic");
  }
  return parts.join(";");
}

export function documentTypographyStyleAttr(typography: DocumentTypography | undefined): string {
  const style = documentTypographyInlineStyle(typography);
  return style ? ` style="${style}"` : "";
}

export function documentColumnTypographyStyleAttr(
  column: Pick<DocumentColumnPref, "typography" | "labelTypography" | "valueTypography">,
  role: DocumentTypographyRole
): string {
  return documentTypographyStyleAttr(resolveColumnTypography(column, role));
}

export function printColumnHeaderStyle(
  column: Pick<DocumentColumnPref, "align" | "typography" | "labelTypography" | "valueTypography">
): string {
  const align = column.align === "right" ? "right" : column.align === "center" ? "center" : "left";
  const parts = [`text-align:${align}`];
  const typography = documentTypographyInlineStyle(resolveColumnTypography(column, "label"));
  if (typography) parts.push(typography);
  return parts.join(";");
}

export function printColumnCellStyle(
  column: Pick<DocumentColumnPref, "align" | "typography" | "labelTypography" | "valueTypography">
): string {
  const align = column.align === "right" ? "right" : column.align === "center" ? "center" : "left";
  const parts = [`text-align:${align}`];
  const typography = documentTypographyInlineStyle(resolveColumnTypography(column, "value"));
  if (typography) parts.push(typography);
  return parts.join(";");
}
