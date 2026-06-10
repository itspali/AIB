export function resolveAddedLineScrollTargetKey(
  previousKeys: readonly string[],
  nextKeys: readonly string[],
  anchor: "top" | "bottom"
): string | null {
  if (nextKeys.length <= previousKeys.length) return null;

  const previous = new Set(previousKeys);
  const added = nextKeys.filter((key) => !previous.has(key));
  if (added.length === 0) return null;

  if (anchor === "top" && added.includes(nextKeys[0]!)) {
    return nextKeys[0]!;
  }

  return added[added.length - 1]!;
}

/** Scroll an overflow container so `element` is visible without scrolling outer ancestors. */
export function scrollElementWithinOverflowContainer(
  container: HTMLElement,
  element: HTMLElement,
  options?: { edge?: "start" | "end"; padding?: number }
): boolean {
  const padding = options?.padding ?? 4;
  const edge = options?.edge ?? "end";
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  if (edge === "end") {
    const overflow = elementRect.bottom - (containerRect.bottom - padding);
    if (overflow <= 0) return false;
    container.scrollTop += overflow;
    return true;
  }

  const overflow = containerRect.top + padding - elementRect.top;
  if (overflow <= 0) return false;
  container.scrollTop -= overflow;
  return true;
}
