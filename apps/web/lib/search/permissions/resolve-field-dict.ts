import { getFieldsForScope } from "@/lib/search/permissions/field-registry";
import type {
  FilterScope,
  ResolvedFieldDictEntry,
  SearchFieldPermissions,
} from "@/lib/search/types";

export function buildFieldDict(
  scope: FilterScope,
  permissions: SearchFieldPermissions
): ResolvedFieldDictEntry[] {
  const fields = getFieldsForScope(scope);
  const allowed = new Set(permissions.allowedFields);

  return fields
    .filter((entry) => {
      if (permissions.throttled && entry.sensitivity === "financial") return false;
      if (entry.sensitivity === "financial" && !permissions.financialVisible) return false;
      return allowed.has(entry.key);
    })
    .map((entry) => ({
      key: entry.key,
      synonyms: entry.synonyms,
    }));
}

export function resolveAllowedFieldKeys(
  scope: FilterScope,
  permissions: SearchFieldPermissions
): string[] {
  return buildFieldDict(scope, permissions).map((entry) => entry.key);
}
