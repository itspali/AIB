export function pruneCustomFieldValues(
  values: Record<string, string>,
  allowedKeys: readonly string[]
): Record<string, string> {
  if (allowedKeys.length === 0) return {};

  const allowed = new Set(allowedKeys);
  const pruned: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    if (allowed.has(key)) {
      pruned[key] = value;
    }
  }

  return pruned;
}
