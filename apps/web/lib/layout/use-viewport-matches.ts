"use client";

import { useEffect, useState } from "react";

export function useViewportMatches(mediaQuery: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(mediaQuery).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(mediaQuery);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [mediaQuery]);

  return matches;
}
