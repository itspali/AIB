import { GstrExportPanel } from "@/components/settings/tax/gstr-export-panel";
import { SettingsGlassShell } from "@/components/settings/settings-glass-shell";

export default function GstrSettingsPage() {
  return (
    <SettingsGlassShell className="canvas-scroll-endpad mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GSTR export</h1>
        <p className="text-sm text-muted-foreground">
          Generate structured JSON exports for GSTR-1, GSTR-2, and GSTR-3B reporting periods.
        </p>
      </div>
      <GstrExportPanel />
    </SettingsGlassShell>
  );
}
