"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponentModule = Record<string, ComponentType<any>>;

export function lazyClientExport(loader: () => Promise<AnyComponentModule>, exportName: string) {
  return dynamic(() => loader().then((module) => ({ default: module[exportName] })), {
    ssr: false,
  });
}
