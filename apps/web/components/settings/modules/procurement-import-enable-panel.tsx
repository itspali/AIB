"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveImportLogisticsSettings } from "@/app/settings/operations/procurement/actions";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";

type Props = {
  initialSettings: ImportLogisticsSettings;
  canEdit: boolean;
};

export function ProcurementImportEnablePanel({ initialSettings, canEdit }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();
  const isDirty = settings.imports_enabled !== initialSettings.imports_enabled;

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveImportLogisticsSettings(settings);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        settings.imports_enabled
          ? "Import logistics enabled for this workspace."
          : "Import logistics disabled."
      );
      window.location.reload();
    });
  };

  return (
    <OrgSettingsSection
      title="Import logistics"
      description="Enable overseas import workflows — shipments, staging receipts, and goods-in-transit. Domestic-only tenants can leave this off."
    >
      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium">We import goods from overseas</p>
          <p className="text-xs text-muted-foreground">
            Shows import shipments, GIT, staging settings, and related fields on import purchase
            orders.
          </p>
        </div>
        <Switch
          checked={settings.imports_enabled}
          disabled={!canEdit || isPending}
          onCheckedChange={(checked) =>
            setSettings((current) => ({ ...current, imports_enabled: checked }))
          }
        />
      </div>
      {canEdit && isDirty ? (
        <div className="flex justify-end pt-2">
          <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
    </OrgSettingsSection>
  );
}
