/** Normalize a key for uniqueness comparisons. */
export function normalizeAttributeKey(key: string): string {
  return key.trim().toLowerCase();
}

/** Slugify a display label into a stable snake_case attribute key. */
export function slugifyAttributeKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 64);

  return slug || "field";
}

/** Pick a unique key among sibling template rows, suffixing _2, _3, … when needed. */
export function suggestUniqueAttributeKey(
  label: string,
  rows: { key: string }[],
  rowIndex: number
): string {
  const base = slugifyAttributeKey(label);
  const used = new Set(
    rows
      .map((row, index) =>
        index === rowIndex ? null : normalizeAttributeKey(row.key)
      )
      .filter((key): key is string => Boolean(key))
  );

  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

/** True when another row already uses the same key (case-insensitive). */
export function isDuplicateAttributeKey(
  rows: { key: string }[],
  rowIndex: number
): boolean {
  const key = normalizeAttributeKey(rows[rowIndex]?.key ?? "");
  if (!key) return false;

  return rows.some(
    (row, index) => index !== rowIndex && normalizeAttributeKey(row.key) === key
  );
}
