"use client";

import { useCallback, useEffect, useState } from "react";
import {
  normalizePoLinesForAnchor,
  poLinesNeedAnchorNormalization,
  type PoDraftLine,
} from "@/lib/procurement/purchase-orders/draft-form";
import {
  readPoLineEntryAnchor,
  writePoLineEntryAnchor,
  type PoLineEntryAnchor,
} from "@/lib/procurement/purchase-orders/line-entry-anchor";

type Options = {
  /** Set false when anchor state is owned by a parent (avoids duplicate normalization). */
  enabled?: boolean;
};

export function usePoLineEntryAnchor(
  lines: PoDraftLine[],
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void,
  options?: Options
) {
  const enabled = options?.enabled ?? true;
  const [entryAnchor, setEntryAnchor] = useState<PoLineEntryAnchor>("bottom");

  useEffect(() => {
    setEntryAnchor(readPoLineEntryAnchor());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!poLinesNeedAnchorNormalization(lines, entryAnchor)) return;
    const normalized = normalizePoLinesForAnchor(lines, entryAnchor);
    const sameLineKeys =
      normalized.length === lines.length &&
      normalized.every((line, index) => line.key === lines[index]?.key);
    if (sameLineKeys) return;
    onChange(normalized);
  }, [enabled, entryAnchor, lines, onChange]);

  const handleEntryAnchorChange = useCallback(
    (anchor: PoLineEntryAnchor) => {
      setEntryAnchor(anchor);
      writePoLineEntryAnchor(anchor);
      onChange((current) => normalizePoLinesForAnchor(current, anchor));
    },
    [onChange]
  );

  return { entryAnchor, handleEntryAnchorChange };
}
