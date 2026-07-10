import {
  ATTRIBUTE_OPTION_HEURISTIC_SEGMENT_MAX,
  findAttributeOptionByLabel,
  resolveAttributeOptionSkuCode,
} from "@/lib/categories/attribute-options";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import type { ScanIdentifierPolicy } from "@/lib/products/catalog-item-settings";

/** Max SKU length recommended for small Code 128 labels when GTIN is absent. */
export const SCAN_FRIENDLY_SKU_MAX_LENGTH = 20;

/** Soft target for compact sticker printing. */
export const SCAN_FRIENDLY_SKU_RECOMMENDED_LENGTH = 16;

/** Prefix for single-SKU / item sellable codes (keeps Excel from treating SKUs as numbers). */
export const SCAN_FRIENDLY_SKU_ITEM_PREFIX = "I";

/** Prefix for variant sellable codes. */
export const SCAN_FRIENDLY_SKU_VARIANT_PREFIX = "V";

export type ScanFriendlySkuKind = "item" | "variant";

const MAX_AXIS_SEGMENT_LENGTH = ATTRIBUTE_OPTION_HEURISTIC_SEGMENT_MAX;

export function scanPolicyMayUseSku(policy: ScanIdentifierPolicy): boolean {
  return policy === "SKU" || policy === "GTIN_THEN_SKU";
}

/** Encode one axis value as a short alphanumeric segment for barcode labels. */
export function encodeScanFriendlyAxisSegment(
  value: string,
  template?: AttributeTemplateEntry
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (template?.type === "select" && template.options?.length) {
    const explicit = resolveAttributeOptionSkuCode(trimmed, template.options);
    if (explicit) return explicit;

    const match = findAttributeOptionByLabel(template.options, trimmed);
    if (match) {
      const index = template.options.findIndex(
        (option) => option.label.trim().toLowerCase() === trimmed.toLowerCase()
      );
      const literal = trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      if (literal.length >= 1 && literal.length <= MAX_AXIS_SEGMENT_LENGTH) {
        return literal;
      }
      return encodeOptionIndex(index);
    }
  }

  const alnum = trimmed.replace(/[^a-zA-Z0-9]/g, "");
  if (!alnum) return "X";
  if (alnum.length <= MAX_AXIS_SEGMENT_LENGTH) return alnum.toUpperCase();

  const words = trimmed.split(/[\s\-_]+/).filter(Boolean);
  if (words.length > 1) {
    const initials = words
      .map((word) => word.replace(/[^a-zA-Z0-9]/g, "")[0] ?? "")
      .join("")
      .toUpperCase();
    if (initials) return initials.slice(0, MAX_AXIS_SEGMENT_LENGTH);
  }

  return alnum.slice(0, MAX_AXIS_SEGMENT_LENGTH).toUpperCase();
}

function encodeOptionIndex(index: number): string {
  if (index < 0) return "X";
  if (index < 10) return String(index);
  if (index < 36) return String.fromCharCode(55 + index);
  return String(index % 36);
}

/** Compact product-code segment: prefer the numeric core (e.g. ITEM-000123 → 000123). */
export function compactBaseSkuSegment(baseSku: string): string {
  const trimmed = baseSku.trim();
  if (!trimmed) return "ITEM";

  const digitRuns = trimmed.match(/\d+/g);
  if (digitRuns?.length) {
    const longest = digitRuns.reduce((longestRun, run) =>
      run.length >= longestRun.length ? run : longestRun
    );
    if (longest.length >= 4) return longest;
  }

  const compact = trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return compact.slice(0, 8) || "ITEM";
}

export function normalizeScanFriendlySku(sku: string): string {
  return sku.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function skuTypePrefix(kind: ScanFriendlySkuKind): string {
  return kind === "variant"
    ? SCAN_FRIENDLY_SKU_VARIANT_PREFIX
    : SCAN_FRIENDLY_SKU_ITEM_PREFIX;
}

/**
 * Ensure a compact SKU starts with I (item) or V (variant).
 * Strips an existing I/V type prefix when it is followed by a digit so re-compose stays idempotent.
 */
export function applyScanFriendlySkuPrefix(
  sku: string,
  kind: ScanFriendlySkuKind
): string {
  const prefix = skuTypePrefix(kind);
  const normalized = normalizeScanFriendlySku(sku);
  if (!normalized) return prefix;

  const body = /^[IV]\d/.test(normalized) ? normalized.slice(1) : normalized;
  return `${prefix}${body}`;
}

/**
 * Validate SKU shape for barcode printing when scans may use SKU instead of GTIN.
 * Returns an error message, or null when acceptable.
 */
export function validateScanFriendlySku(sku: string): string | null {
  const trimmed = sku.trim();
  if (!trimmed) return "SKU is required.";

  const normalized = normalizeScanFriendlySku(trimmed);
  if (!normalized) {
    return "Use only letters and numbers so the SKU encodes cleanly as a barcode.";
  }
  if (normalized.length !== trimmed.replace(/\s/g, "").length) {
    return "Avoid spaces and symbols in SKUs used as barcode fallbacks.";
  }
  if (normalized.length > SCAN_FRIENDLY_SKU_MAX_LENGTH) {
    return `SKU is ${normalized.length} characters; use ${SCAN_FRIENDLY_SKU_MAX_LENGTH} or fewer for small barcode stickers.`;
  }
  return null;
}

export function validateScanFriendlySkuBatch(
  skus: string[],
  policy: ScanIdentifierPolicy
): string | null {
  if (!scanPolicyMayUseSku(policy)) return null;
  for (const sku of skus) {
    const issue = validateScanFriendlySku(sku);
    if (issue) return issue;
  }
  return null;
}

export function scanFriendlySkuFieldHint(policy: ScanIdentifierPolicy): string {
  if (!scanPolicyMayUseSku(policy)) {
    return "Internal sellable code. Example: V00012301.";
  }
  return `Short letters and numbers only (max ${SCAN_FRIENDLY_SKU_MAX_LENGTH} chars) — used as the barcode when GTIN is blank. Example: V00012301 or V000123RD1.`;
}
