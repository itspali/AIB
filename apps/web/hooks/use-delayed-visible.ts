"use client";

import { useEffect, useState } from "react";

/** Becomes true after `delayMs` while `active` stays true; resets immediately when inactive. */
export function useDelayedVisible(active: boolean, delayMs = 150): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return visible;
}
