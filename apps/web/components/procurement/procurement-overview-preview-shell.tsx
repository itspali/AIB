"use client";

import { ModulePreviewShell } from "@/components/appearance/module-preview-shell";

type ProcurementOverviewPreviewShellProps = {
  classic: React.ReactNode;
  revamp: React.ReactNode;
};

/**
 * @deprecated Production procurement overview uses `ProcurementOverviewTerminalV2` directly.
 * Kept for document designer / appearance tooling until Phase 6 preview audit.
 */
export function ProcurementOverviewPreviewShell({
  classic,
  revamp,
}: ProcurementOverviewPreviewShellProps) {
  return (
    <ModulePreviewShell
      classic={classic}
      revamp={revamp}
      moduleName="Procurement"
      previewMode="overview"
    />
  );
}
