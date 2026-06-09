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
  const [entryAnchor, setEntryAnchor] = useState<PoLineEntryAnchor>(() => readPoLineEntryAnchor());

  useEffect(() => {
    if (!enabled) return;
    if (!poLinesNeedAnchorNormalization(lines, entryAnchor)) return;
    onChange(normalizePoLinesForAnchor(lines, entryAnchor));
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
