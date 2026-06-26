"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveImportLogisticsSettings } from "@/app/settings/operations/procurement/actions";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";

type Props = {
  initialSettings: ImportLogisticsSettings;
  canEdit: boolean;
};

export function ImportLogisticsPoliciesPanel({ initialSettings, canEdit }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();
  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const patch = (partial: Partial<ImportLogisticsSettings>) => {
    setSettings((current) => ({ ...current, ...partial }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveImportLogisticsSettings(settings);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Import & logistics settings saved.");
    });
  };

  return (
    <OrgSettingsSection
      title="Import & logistics"
      description="Configure how overseas purchase receipts, staging locations, and goods-in-transit behave for your tenant."
    >
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label>Receipt document style</Label>
          <Select
            value={settings.import_receipt_document_strategy}
            disabled={!canEdit}
            onValueChange={(value) =>
              patch({
                import_receipt_document_strategy:
                  value as ImportLogisticsSettings["import_receipt_document_strategy"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SINGLE_FINAL_ONLY">Single final GRN (simple)</SelectItem>
              <SelectItem value="SINGLE_GRN_WITH_STAGES">Single GRN with stages</SelectItem>
              <SelectItem value="SEPARATE_GRNS_PER_STAGE">Separate GRN per stage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Import receipt mode</Label>
          <Select
            value={settings.import_receipt_mode}
            disabled={!canEdit}
            onValueChange={(value) =>
              patch({
                import_receipt_mode: value as ImportLogisticsSettings["import_receipt_mode"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DIRECT_TO_WAREHOUSE">Direct to warehouse</SelectItem>
              <SelectItem value="STAGING_THEN_GIT">Staging, then GIT to main WH</SelectItem>
              <SelectItem value="STAGING_THEN_TRANSFER">Staging, then stock transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Default PO fulfillment stage</Label>
          <Select
            value={settings.po_fulfillment_stage}
            disabled={!canEdit}
            onValueChange={(value) =>
              patch({ po_fulfillment_stage: value as ImportLogisticsSettings["po_fulfillment_stage"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMMERCIAL">Commercial receipt (agent / port)</SelectItem>
              <SelectItem value="FINAL">Final warehouse receipt</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Purchase orders may override this default when created.
          </p>
        </div>

        <div className="grid gap-2">
          <Label>Bill of entry requirement</Label>
          <Select
            value={settings.require_boe_on_first_receipt}
            disabled={!canEdit}
            onValueChange={(value) =>
              patch({
                require_boe_on_first_receipt:
                  value as ImportLogisticsSettings["require_boe_on_first_receipt"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALWAYS">Always on first import GRN</SelectItem>
              <SelectItem value="ON_FINAL_RECEIPT_ONLY">Only on final receipt</SelectItem>
              <SelectItem value="NEVER">Never enforce via system</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Allow staging location mismatch</p>
            <p className="text-xs text-muted-foreground">
              Receive at port / agent location when PO ultimate destination differs.
            </p>
          </div>
          <Switch
            checked={settings.allow_staging_receipt_location_mismatch}
            disabled={!canEdit}
            onCheckedChange={(checked) =>
              patch({ allow_staging_receipt_location_mismatch: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Commercial receipt before customs</p>
            <p className="text-xs text-muted-foreground">
              Allow ownership receipt before BoE / duty assessment.
            </p>
          </div>
          <Switch
            checked={settings.allow_commercial_receipt_before_customs}
            disabled={!canEdit}
            onCheckedChange={(checked) =>
              patch({ allow_commercial_receipt_before_customs: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Goods in transit (import)</p>
            <p className="text-xs text-muted-foreground">
              Enable procurement GIT for import shipments. Domestic moves use stock transfers.
            </p>
          </div>
          <Switch
            checked={settings.git_enabled}
            disabled={!canEdit}
            onCheckedChange={(checked) => patch({ git_enabled: checked })}
          />
        </div>

        {canEdit ? (
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={!isDirty || isPending} onClick={handleSave}>
              {isPending ? "Saving…" : "Save import settings"}
            </Button>
          </div>
        ) : null}
      </div>
    </OrgSettingsSection>
  );
}
