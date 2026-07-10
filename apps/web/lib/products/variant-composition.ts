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

export function hasVariantAxisCandidates(templates: AttributeTemplateEntry[]): boolean {
  return filterVariantAxisCandidateTemplates(templates).length > 0;
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

export function toggleVariantAxisKey(axisKeys: readonly string[], key: string): string[] {
  if (axisKeys.includes(key)) {
    return axisKeys.filter((candidate) => candidate !== key);
  }
  return [...axisKeys, key];
}

export function moveVariantAxisKey(
  axisKeys: readonly string[],
  key: string,
  direction: -1 | 1
): string[] {
  const index = axisKeys.indexOf(key);
  if (index < 0) return [...axisKeys];
  const target = index + direction;
  if (target < 0 || target >= axisKeys.length) return [...axisKeys];
  const next = [...axisKeys];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function countSellableVariants(
  variants: Array<{ is_master?: boolean; is_sellable?: boolean }>
): number {
  return variants.filter((variant) => !variant.is_master && variant.is_sellable !== false).length;
}

/** Non-master variant/SKU rows (excludes the style-anchor master row). */
export function countVariantSkuRows(
  variants: Array<{ is_master?: boolean }>
): number {
  return variants.filter((variant) => !variant.is_master).length;
}

/** Lock product code once any variant SKU rows exist under the style master. */
export function shouldLockProductCode(variants: Array<{ is_master?: boolean }>): boolean {
  return countVariantSkuRows(variants) >= 1;
}

/**
 * True when the SKUs section should show the single-SKU entry row (SKU + GTIN on one form),
 * not the multi-SKU product-code-only field.
 */
export function shouldShowSingleSkuEntryFields(input: {
  isMultiSku: boolean;
  variantAxisKeys: string[];
  sellableVariantCount: number;
  variants: Array<{ is_master?: boolean }>;
}): boolean {
  if (input.variantAxisKeys.length > 0) return false;
  if (!input.isMultiSku) return true;
  if (input.sellableVariantCount >= 2) return false;
  if (countVariantSkuRows(input.variants) >= 1) return false;
  return true;
}

/** Multi-variant items get a dedicated Variants wizard stage (axes setup stays in Essentials). */
export function shouldShowVariantsWizardStage(input: {
  isMultiSku: boolean;
  variantAxisKeys: string[];
  sellableVariantCount: number;
  variants: Array<{ is_master?: boolean }>;
}): boolean {
  return !shouldShowSingleSkuEntryFields(input);
}

/** Resolve whether the Variants wizard stage applies from a saved item snapshot. */
export function variantsWizardStageFromDetail(input: {
  item_type: string;
  variant_strategy: string;
  variant_axes?: string[] | null;
  variants?: Array<{ is_master?: boolean; is_sellable?: boolean }>;
}): boolean {
  if (input.item_type !== "PHYSICAL") return false;
  const variants = input.variants ?? [];
  return shouldShowVariantsWizardStage({
    isMultiSku: input.variant_strategy === "MULTI_SKU",
    variantAxisKeys: input.variant_axes ?? [],
    sellableVariantCount: countSellableVariants(variants),
    variants,
  });
}

/** Live form state plus persisted detail (post-save) for wizard stage visibility. */
export function resolveShowVariantsWizardStage(input: {
  isMultiSku: boolean;
  variantAxisKeys: string[];
  sellableVariantCount: number;
  variants: Array<{ is_master?: boolean; is_sellable?: boolean }>;
  detail?: {
    item_type: string;
    variant_strategy: string;
    variant_axes?: string[] | null;
    variants?: Array<{ is_master?: boolean; is_sellable?: boolean }>;
  } | null;
}): boolean {
  if (
    shouldShowVariantsWizardStage({
      isMultiSku: input.isMultiSku,
      variantAxisKeys: input.variantAxisKeys,
      sellableVariantCount: input.sellableVariantCount,
      variants: input.variants,
    })
  ) {
    return true;
  }
  if (input.detail) {
    return variantsWizardStageFromDetail(input.detail);
  }
  return false;
}

/** Keeps unsaved items in single-SKU form mode until variant axes or SKU rows exist. */
export function resolveFormVariantStrategy(
  inferred: "SINGLE_SKU" | "MULTI_SKU",
  input: {
    itemId: string | null;
    variantAxisKeys: string[];
    sellableVariantCount: number;
    variants: Array<{ is_master?: boolean }>;
  }
): "SINGLE_SKU" | "MULTI_SKU" {
  if (
    !input.itemId &&
    input.variantAxisKeys.length === 0 &&
    input.sellableVariantCount === 0 &&
    countVariantSkuRows(input.variants) === 0
  ) {
    return "SINGLE_SKU";
  }
  return inferred;
}

/** Lock axis chips once two or more sellable SKU rows exist (not the master-only row). */
export function shouldLockVariantAxisPicker(
  variants: Array<{ is_master?: boolean; is_sellable?: boolean }>
): boolean {
  return countSellableVariants(variants) >= 2;
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
  const orderedKeys = [...axisKeys];
  const axisSet = new Set(orderedKeys);
  const byKey = new Map(templates.map((template) => [template.key, template]));
  const axes: AttributeTemplateEntry[] = [];
  for (const key of orderedKeys) {
    const template = byKey.get(key);
    if (template) axes.push(template);
  }
  const descriptive: AttributeTemplateEntry[] = [];
  for (const template of templates) {
    if (!axisSet.has(template.key)) {
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

export type VariantCompositionMode = "draft" | "live";

/** Draft composition on Essentials create wizard until the user continues to the next step. */
export function resolveVariantCompositionMode(input: {
  activeWizardStage: string | null;
  wizardActive: boolean;
  wizardSteps: boolean;
}): VariantCompositionMode {
  if (
    input.activeWizardStage === "essentials" &&
    input.wizardActive &&
    input.wizardSteps
  ) {
    return "draft";
  }
  return "live";
}

/** When the variant matrix / axis picker should drive SKU composition in the SKUs section. */
export function shouldComposeVariants(input: {
  isMultiSku: boolean;
  compositionMode: VariantCompositionMode;
  variantAxisCount: number;
}): boolean {
  return (
    input.isMultiSku ||
    input.compositionMode === "draft" ||
    input.variantAxisCount > 0
  );
}
