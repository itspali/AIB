"use client";

import { useEffect, useRef, useState } from "react";

/** Tracks the content-box width of an element via ResizeObserver. */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      setWidth(node.clientWidth);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
