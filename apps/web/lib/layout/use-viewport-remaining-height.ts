"use client";

import { useLayoutEffect, useRef, useState } from "react";

const MOBILE_NAV_OFFSET_PX = 56;
const BOTTOM_GAP_PX = 8;
const MIN_HEIGHT_PX = 200;

export type PaneHeightMeasure = "parent" | "remaining-viewport";

export function measureViewportRemainingHeight(anchorTop: number): number {
  const mobileNav = window.matchMedia("(max-width: 767px)").matches
    ? MOBILE_NAV_OFFSET_PX
    : 0;
  return Math.max(
    MIN_HEIGHT_PX,
    Math.floor(window.innerHeight - anchorTop - mobileNav - BOTTOM_GAP_PX)
  );
}

/**
 * Fills the split pane to the parent slot height when available, otherwise
 * measures from the element's top edge to the viewport bottom.
 */
export function useAvailablePaneHeight(
  enabled = true,
  measureMode: PaneHeightMeasure = "parent"
) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!enabled) {
      setHeight(undefined);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const measure = () => {
      if (measureMode === "remaining-viewport") {
        const top = Math.max(0, node.getBoundingClientRect().top);
        setHeight(measureViewportRemainingHeight(top));
        return;
      }

      const parent = node.parentElement;
      if (parent && parent.clientHeight > MIN_HEIGHT_PX) {
        setHeight(parent.clientHeight);
        return;
      }

      const top = Math.max(0, node.getBoundingClientRect().top);
      setHeight(measureViewportRemainingHeight(top));
    };

    measure();

    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.parentElement) observer.observe(node.parentElement);

    const scrollRoot = document.querySelector("[data-dashboard-scroll-root]");
    if (scrollRoot) {
      observer.observe(scrollRoot);
      scrollRoot.addEventListener("scroll", measure, { passive: true });
    }

    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      observer.disconnect();
      scrollRoot?.removeEventListener("scroll", measure);
    };
  }, [enabled, measureMode]);

  return { ref, height };
}
