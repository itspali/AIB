"use client";

import { useCallback, useRef, useState } from "react";

/** Tracks the content-box width of an element via ResizeObserver. */
export function useElementWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState<number | undefined>(undefined);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) return;

    const measure = () => {
      setWidth(node.clientWidth);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  return { ref, width };
}
