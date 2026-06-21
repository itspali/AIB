"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { ProfileSettingsTerminalProps } from "@/components/settings/profile-settings-terminal";

const ProfileSettingsTerminal = lazyClientExport(
  () => import("@/components/settings/profile-settings-terminal"),
  "ProfileSettingsTerminal"
);

export function ProfileSettingsTerminalLazy(props: ProfileSettingsTerminalProps) {
  return <ProfileSettingsTerminal {...props} />;
}
