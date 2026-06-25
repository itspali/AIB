"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Glass V2 panel wrapper for settings and configuration pages. */
export function SettingsGlassShell({ children, className }: Props) {
  return <div className={cn("settings-glass-shell", className)}>{children}</div>;
}
