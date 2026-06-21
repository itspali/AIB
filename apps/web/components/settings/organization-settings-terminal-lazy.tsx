"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { OrganizationSettingsTerminalProps } from "@/components/settings/organization-settings-terminal";

const OrganizationSettingsTerminal = lazyClientExport(
  () => import("@/components/settings/organization-settings-terminal"),
  "OrganizationSettingsTerminal"
);

export function OrganizationSettingsTerminalLazy(props: OrganizationSettingsTerminalProps) {
  return <OrganizationSettingsTerminal {...props} />;
}
