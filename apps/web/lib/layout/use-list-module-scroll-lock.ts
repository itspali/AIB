"use client";

import { useEffect } from "react";

/** Prevents dashboard page scroll so only the list body scrolls internally. */
export function useListModuleScrollLock(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const scrollRoot = document.querySelector<HTMLElement>("[data-dashboard-scroll-root]");
    if (!scrollRoot) return;

    scrollRoot.style.overflow = "hidden";
    return () => {
      scrollRoot.style.removeProperty("overflow");
    };
  }, [enabled]);
}
