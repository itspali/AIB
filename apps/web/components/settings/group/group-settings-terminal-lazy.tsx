"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { GroupSettingsTerminalProps } from "@/components/settings/group/group-settings-terminal";

const GroupSettingsTerminal = lazyClientExport(
  () => import("@/components/settings/group/group-settings-terminal"),
  "GroupSettingsTerminal"
);

export function GroupSettingsTerminalLazy(props: GroupSettingsTerminalProps) {
  return <GroupSettingsTerminal {...props} />;
}
