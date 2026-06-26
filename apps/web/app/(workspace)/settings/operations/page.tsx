import { ModuleOverview } from "@/components/layout/module-overview";
import { SettingsHubShell } from "@/components/settings/shells/settings-hub-shell";
import { OPERATIONS_HUB_CARDS } from "@/lib/settings/navigation";

export default function OperationsSettingsPage() {
  return (
    <SettingsHubShell>
      <div className="canvas-scroll-endpad">
        <ModuleOverview
          title="Module settings"
          description="Configure how operational modules behave — policies, approvals, and module-specific options."
          cards={OPERATIONS_HUB_CARDS}
        />
      </div>
    </SettingsHubShell>
  );
}
