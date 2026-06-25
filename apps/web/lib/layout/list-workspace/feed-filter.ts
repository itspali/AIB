/** Client-side feed filter for split list pane and matrix table (Items/Categories parity). */

export function filterRowsByFeedQuery<T>(
  rows: readonly T[],
  query: string,
  extractSearchable: (row: T) => Iterable<string | null | undefined>
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...rows];

  return rows.filter((row) => {
    for (const value of extractSearchable(row)) {
      if (value?.toLowerCase().includes(normalized)) return true;
    }
    return false;
  });
}
