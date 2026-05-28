import { attributeTypeLabel, attributeTypeNeedsOptions } from "@/lib/categories/attribute-types";
import type { AttributeTemplateEntry } from "@/lib/categories/types";

export function resolveAttributeOptions(
  entry: AttributeTemplateEntry,
  optionsDraft?: string
): string[] {
  if (optionsDraft !== undefined) {
    return optionsDraft
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
  }

  return (entry.options ?? []).map((option) => option.trim()).filter(Boolean);
}

export function attributeTemplateMissingOptions(
  entry: AttributeTemplateEntry,
  optionsDraft?: string
): boolean {
  if (!attributeTypeNeedsOptions(entry.type)) return false;
  if (!entry.key.trim() && !entry.label.trim()) return false;
  return resolveAttributeOptions(entry, optionsDraft).length === 0;
}

export function validateAttributeTemplates(
  entries: AttributeTemplateEntry[],
  optionsDrafts: Record<number, string> = {}
): string | null {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry.key.trim()) continue;

    if (attributeTemplateMissingOptions(entry, optionsDrafts[index])) {
      const label = entry.label.trim() || entry.key.trim();
      const typeLabel = attributeTypeLabel(entry.type);
      return `${typeLabel} fields require at least one option. Add choices for "${label}".`;
    }
  }

  return null;
}
