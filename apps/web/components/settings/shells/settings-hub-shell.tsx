"use client";

import type { ReactNode } from "react";
import { OverviewGlassShell } from "@/components/layout/overview-glass-shell";

type Props = {
  children: ReactNode;
};

export function SettingsHubShell({ children }: Props) {
  return <OverviewGlassShell>{children}</OverviewGlassShell>;
}
