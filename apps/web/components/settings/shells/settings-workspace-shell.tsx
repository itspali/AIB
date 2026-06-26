"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

export function SettingsWorkspaceShell({ children, className }: Props) {
  return (
    <div className={cn("settings-workspace-shell flex h-full min-h-0 flex-col", className)}>
      {children}
    </div>
  );
}
