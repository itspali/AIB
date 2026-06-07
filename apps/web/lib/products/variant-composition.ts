import type { AttributeFieldType } from "@/lib/categories/attribute-types";
import type { AttributeTemplateEntry } from "@/lib/categories/types";

export type VariantCompositionSplit = {
  /** Attributes that split the item into separate SKUs (e.g. Size). */
  axes: AttributeTemplateEntry[];
  /** Attributes that describe the item but stay the same across SKUs (e.g. Brand). */
  descriptive: AttributeTemplateEntry[];
};

/**
 * Choice-typed attributes (with a fixed option list) are the natural default
 * for variant axes; everything else describes the item unless the author opts
 * in. This is only a starting suggestion — the item author always decides.
 */
const DEFAULT_AXIS_TYPES: ReadonlySet<AttributeFieldType> = new Set<AttributeFieldType>([
  "select",
]);

export function isDefaultAxisTemplate(template: AttributeTemplateEntry): boolean {
  if (!isVariantAxisCandidate(template)) return false;
  // An explicit category role wins over the type-based heuristic.
  if (template.role === "axis") return true;
  if (template.role === "descriptive") return false;
  return DEFAULT_AXIS_TYPES.has(template.type) && (template.options?.length ?? 0) > 0;
}

/** Attributes that may appear in the “Varies by” picker (excludes multiselect). */
export function isVariantAxisCandidate(template: AttributeTemplateEntry): boolean {
  if (template.type === "multiselect") return false;
  if (template.role === "descriptive") return false;
  return true;
}

export function filterVariantAxisCandidateTemplates(
  templates: AttributeTemplateEntry[]
): AttributeTemplateEntry[] {
  return templates.filter(isVariantAxisCandidate);
}

export function sanitizeVariantAxisKeys(
  axisKeys: Iterable<string>,
  templates: AttributeTemplateEntry[]
): string[] {
  const allowed = new Set(
    filterVariantAxisCandidateTemplates(templates).map((template) => template.key)
  );
  return [...axisKeys].filter((key) => allowed.has(key));
}

export function countSellableVariants(
  variants: Array<{ is_master?: boolean; is_sellable?: boolean }>
): number {
  return variants.filter((variant) => !variant.is_master && variant.is_sellable !== false).length;
}

/** Product-level attribute values — category fields not used as variant axes. */
export function pickDescriptiveVariantAttributes(
  attributes: Record<string, string>,
  templates: AttributeTemplateEntry[],
  axisKeys: Iterable<string>
): Record<string, string> {
  const { descriptive } = splitTemplatesByAxis(templates, axisKeys);
  const picked: Record<string, string> = {};
  for (const template of descriptive) {
    if (attributes[template.key] !== undefined) {
      picked[template.key] = attributes[template.key] ?? "";
    }
  }
  return picked;
}

export function formatVariantAxisLabels(
  axisKeys: string[],
  templates: AttributeTemplateEntry[]
): string {
  if (!axisKeys.length) return "";
  return axisKeys
    .map((key) => templates.find((template) => template.key === key)?.label ?? key)
    .join(", ");
}

export function formatDescriptiveVariantAttributes(
  attributes: Record<string, unknown> | null | undefined,
  templates: AttributeTemplateEntry[],
  axisKeys: Iterable<string>
): string {
  const { descriptive } = splitTemplatesByAxis(templates, axisKeys);
  const parts = descriptive
    .map((template) => {
      const raw = attributes?.[template.key];
      if (raw === null || raw === undefined) return null;
      const text = Array.isArray(raw)
        ? raw.map(String).filter(Boolean).join(", ")
        : String(raw).trim();
      if (!text) return null;
      return `${template.label}: ${text}`;
    })
    .filter((entry): entry is string => Boolean(entry));
  return parts.length ? parts.join(" · ") : "";
}

/** Attribute keys already used (with a non-empty value) by existing variants. */
export function usedVariantAttributeKeys(
  variants: Array<{ variant_attributes?: Record<string, unknown> | null }>
): string[] {
  const keys = new Set<string>();
  for (const variant of variants) {
    const attributes = variant.variant_attributes ?? {};
    for (const [key, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) continue;
      if (String(value).trim() === "") continue;
      keys.add(key);
    }
  }
  return Array.from(keys);
}

/**
 * Best-guess set of category attributes that compose this item's variants.
 * Existing variant usage wins (any attribute a variant already varies on is an
 * axis); otherwise fall back to the choice-typed templates. Order follows the
 * template list so the UI stays stable.
 *
 * Suggestion only — never persist this return value without explicit author confirmation.
 */
export function defaultVariantAxisKeys(
  templates: AttributeTemplateEntry[],
  usedKeys: Iterable<string> = []
): string[] {
  const used = new Set(usedKeys);
  const fromVariants = templates.filter(
    (template) => used.has(template.key) && isVariantAxisCandidate(template)
  );
  if (fromVariants.length > 0) {
    return fromVariants.map((template) => template.key);
  }
  return templates.filter(isDefaultAxisTemplate).map((template) => template.key);
}

/** Partition templates into variant axes vs descriptive attributes. */
export function splitTemplatesByAxis(
  templates: AttributeTemplateEntry[],
  axisKeys: Iterable<string>
): VariantCompositionSplit {
  const axisSet = new Set(axisKeys);
  const axes: AttributeTemplateEntry[] = [];
  const descriptive: AttributeTemplateEntry[] = [];
  for (const template of templates) {
    if (axisSet.has(template.key)) {
      axes.push(template);
    } else {
      descriptive.push(template);
    }
  }
  return { axes, descriptive };
}

/** Category defines at least one attribute that could split versions. */
export function categoryHasComposableAxes(templates: AttributeTemplateEntry[]): boolean {
  return filterVariantAxisCandidateTemplates(templates).some(
    (template) =>
      template.role === "axis" ||
      ((template.options?.length ?? 0) > 0 && template.role !== "descriptive")
  );
}

const VARIANT_AXES_PATH = "variant_axes" as const;

/**
 * Validates persisted `variant_axes` for multi-SKU physical items.
 * Returns a user-facing message or null when valid / not applicable.
 */
export function validateVariantAxesSelection(input: {
  variant_strategy: string;
  item_type: string;
  variant_axes: string[];
  categoryTemplates: AttributeTemplateEntry[];
}): string | null {
  if (input.variant_strategy !== "MULTI_SKU" || input.item_type !== "PHYSICAL") {
    return null;
  }
  if (!categoryHasComposableAxes(input.categoryTemplates)) {
    return null;
  }
  if (input.variant_axes.length < 1) {
    return "Choose at least one attribute that varies by variant.";
  }
  const allowedTemplates = new Map(
    filterVariantAxisCandidateTemplates(input.categoryTemplates).map((template) => [
      template.key,
      template,
    ])
  );
  for (const key of input.variant_axes) {
    const template = allowedTemplates.get(key);
    if (!template) {
      const onCategory = input.categoryTemplates.some((entry) => entry.key === key);
      if (onCategory) {
        return `"${key}" cannot be used as a variant axis.`;
      }
      return `"${key}" is not defined on this category.`;
    }
  }
  return null;
}

export function variantAxesZodIssuePath(): typeof VARIANT_AXES_PATH {
  return VARIANT_AXES_PATH;
}
