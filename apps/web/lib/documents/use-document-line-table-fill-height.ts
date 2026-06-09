"use client";

import { useEffect, useState } from "react";

/** Tailwind `md` — line tables fill remaining drawer height from here up. */
export const DOCUMENT_LINE_TABLE_FILL_MEDIA = "(min-width: 768px)";

/**
 * True on md+ viewports: line entry tables should fill available drawer height and scroll
 * internally. False below md: table grows with content and the drawer body scrolls.
 */
export function useDocumentLineTableFillHeight(enabled = true): boolean {
  const [fillHeight, setFillHeight] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setFillHeight(false);
      return;
    }

    const media = window.matchMedia(DOCUMENT_LINE_TABLE_FILL_MEDIA);
    const sync = () => setFillHeight(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [enabled]);

  return fillHeight;
}
