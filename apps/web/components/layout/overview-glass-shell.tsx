"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const OVERVIEW_GLASS_ROOT_CLASS = "overview-glass-root";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Glass V2 scope for module overview / command-center layouts (live production path). */
export function OverviewGlassShell({ children, className }: Props) {
  return (
    <div
      className={cn(OVERVIEW_GLASS_ROOT_CLASS, className)}
      data-visual="glass"
      data-density="comfortable"
    >
      {children}
    </div>
  );
}
