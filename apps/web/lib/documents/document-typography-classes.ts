import type { DocumentColumnPref, DocumentTypography } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

export const DOCUMENT_TYPOGRAPHY_DEFAULT = "__default__" as const;

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

export function documentFieldTypographyClassName(
  column: Pick<DocumentColumnPref, "typography"> | undefined,
  defaultClassName: string
): string {
  return documentTypographyClassName(column?.typography, defaultClassName);
}

export function typographySelectValue<T extends string>(
  value: T | undefined,
  fallback = DOCUMENT_TYPOGRAPHY_DEFAULT
): string {
  return value ?? fallback;
}
