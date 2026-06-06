"use client";

import { useEffect, useState } from "react";

/** True after the component has mounted in the browser (false during SSR and first paint). */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
