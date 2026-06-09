/** Keeps a trailing empty row for spreadsheet-style entry. */
export function ensureTrailingEmptyLine<T>(
  lines: T[],
  isComplete: (line: T) => boolean,
  createEmpty: () => T
): T[] {
  const last = lines.at(-1);
  if (!last || isComplete(last)) {
    return [...lines, createEmpty()];
  }
  return lines;
}

export function filterCompleteLines<T>(
  lines: T[],
  isComplete: (line: T) => boolean
): T[] {
  return lines.filter(isComplete);
}
