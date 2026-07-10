import type { AttributeOption, AttributeTemplateEntry } from "@/lib/categories/types";

/** Max length for explicit option SKU codes (e.g. 128G). */
export const ATTRIBUTE_OPTION_CODE_MAX_LENGTH = 4;

/** Heuristic segment length when no explicit code is set. */
export const ATTRIBUTE_OPTION_HEURISTIC_SEGMENT_MAX = 3;

/** Normalize a display label into a default SKU code. */
export function deriveAttributeOptionCode(label: string): string {
  const alnum = label.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!alnum) return "X";
  if (alnum.length <= ATTRIBUTE_OPTION_CODE_MAX_LENGTH) return alnum;
  return alnum.slice(0, ATTRIBUTE_OPTION_CODE_MAX_LENGTH);
}

/** Normalize one option to { label, code }. Accepts legacy strings. */
export function normalizeAttributeOption(raw: unknown): AttributeOption | null {
  if (typeof raw === "string") {
    const label = raw.trim();
    if (!label) return null;
    return { label, code: deriveAttributeOptionCode(label) };
  }
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const label = String(record.label ?? record.value ?? "").trim();
  if (!label) return null;
  const codeRaw = String(record.code ?? "").trim();
  const code = codeRaw
    ? codeRaw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, ATTRIBUTE_OPTION_CODE_MAX_LENGTH) ||
      deriveAttributeOptionCode(label)
    : deriveAttributeOptionCode(label);
  return { label, code };
}

/** Parse template options from JSONB / form payloads (legacy string[] or objects). */
export function parseAttributeOptions(raw: unknown): AttributeOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const options = raw
    .map((entry) => normalizeAttributeOption(entry))
    .filter((entry): entry is AttributeOption => entry != null);
  return options.length > 0 ? options : undefined;
}

/** Labels only — used for select values and variant_attributes storage. */
export function attributeOptionLabels(options: AttributeOption[] | undefined): string[] {
  return (options ?? []).map((option) => option.label);
}

/** Find option by label (case-insensitive). */
export function findAttributeOptionByLabel(
  options: AttributeOption[] | undefined,
  label: string
): AttributeOption | undefined {
  const trimmed = label.trim().toLowerCase();
  if (!trimmed) return undefined;
  return (options ?? []).find((option) => option.label.trim().toLowerCase() === trimmed);
}

/** Resolve SKU segment for a select value, preferring explicit code. */
export function resolveAttributeOptionSkuCode(
  label: string,
  options: AttributeOption[] | undefined
): string | null {
  const match = findAttributeOptionByLabel(options, label);
  if (!match) return null;
  const code = match.code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!code) return null;
  return code.slice(0, ATTRIBUTE_OPTION_CODE_MAX_LENGTH);
}

/** Max segment length across options for length budgeting. */
export function maxAttributeOptionCodeLength(template: AttributeTemplateEntry): number {
  const options = template.options ?? [];
  if (!options.length) return ATTRIBUTE_OPTION_HEURISTIC_SEGMENT_MAX;
  let max = 1;
  for (const option of options) {
    const code = option.code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    max = Math.max(max, Math.min(code.length || 1, ATTRIBUTE_OPTION_CODE_MAX_LENGTH));
  }
  return max;
}

/**
 * Parse a comma-separated options draft into structured options.
 * Supports `Label` or `Label:CODE` / `Label=CODE` per token.
 */
export function parseOptionsDraftInput(raw: string): AttributeOption[] {
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const sep = token.includes(":") ? ":" : token.includes("=") ? "=" : null;
      if (!sep) {
        return normalizeAttributeOption(token)!;
      }
      const [labelPart, codePart] = token.split(sep);
      return normalizeAttributeOption({
        label: labelPart?.trim() ?? "",
        code: codePart?.trim() ?? "",
      })!;
    })
    .filter(Boolean);
}

/** Display options as comma-separated `Label` or `Label:CODE` when code differs from derived. */
export function formatOptionsDraftDisplay(options: AttributeOption[] | undefined): string {
  return (options ?? [])
    .map((option) => {
      const derived = deriveAttributeOptionCode(option.label);
      if (option.code.toUpperCase() === derived) return option.label;
      return `${option.label}:${option.code}`;
    })
    .join(", ");
}
