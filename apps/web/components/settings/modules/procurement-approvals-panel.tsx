"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ProcurementPoApproversSection,
} from "@/components/settings/modules/procurement-po-approvers-section";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import type { WorkspaceEligibleUser } from "@/lib/organization/queries";

type Props = {
  initialSettings: ProcurementApprovalSettings;
  eligibleUsers: WorkspaceEligibleUser[];
  approverProfiles: WorkspaceEligibleUser[];
  canEdit: boolean;
  onSave?: (settings: ProcurementApprovalSettings) => Promise<{ error?: string } | { success: true }>;
};

export function ProcurementApprovalsPanel({
  initialSettings,
  eligibleUsers,
  approverProfiles,
  canEdit,
  onSave,
}: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const patch = (partial: Partial<ProcurementApprovalSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const approverProfilesForSection = approverProfiles.length
    ? approverProfiles
    : eligibleUsers.filter((user) => settings.po_approver_user_ids.includes(user.id));

  const handleSave = () => {
    if (!onSave) return;
    startTransition(async () => {
      const result = await onSave(settings);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Approval settings saved.");
    });
  };

  return (
    <div className="space-y-4">
      <OrgSettingsSection
        title="Purchase order approval"
        description="Control whether purchase orders must be approved before they can be issued to suppliers. Customize message templates under Administration → Notification templates."
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Require approval before issue</p>
              <p className="text-xs text-muted-foreground">
                Draft orders must be submitted and approved before Issue is allowed.
              </p>
            </div>
            <Switch
              checked={settings.require_po_approval_before_issue}
              disabled={!canEdit}
              onCheckedChange={(checked) => patch({ require_po_approval_before_issue: checked })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="po-approval-threshold">Approval threshold (optional)</Label>
            <Input
              id="po-approval-threshold"
              type="number"
              min={0}
              step="0.01"
              placeholder="No threshold — all POs require approval when enabled"
              disabled={!canEdit || !settings.require_po_approval_before_issue}
              value={settings.po_approval_threshold_amount ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                patch({
                  po_approval_threshold_amount: raw === "" ? null : Number(raw),
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              POs at or below this net amount may skip approval when self-approve is enabled.
              Named approvers can approve only up to this amount; workspace owners may approve above
              it.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Allow submitter self-approve below threshold</p>
              <p className="text-xs text-muted-foreground">
                When off, a different approver must approve every order.
              </p>
            </div>
            <Switch
              checked={settings.allow_submitter_self_approve_below_threshold}
              disabled={!canEdit || !settings.require_po_approval_before_issue}
              onCheckedChange={(checked) =>
                patch({ allow_submitter_self_approve_below_threshold: checked })
              }
            />
          </div>
        </div>
      </OrgSettingsSection>

      <OrgSettingsSection
        title="Approvers"
        description="Named users who may approve purchase orders in addition to workspace owners."
      >
        <ProcurementPoApproversSection
          approverUserIds={settings.po_approver_user_ids}
          approverProfiles={approverProfilesForSection}
          eligibleUsers={eligibleUsers.filter(
            (user) => !settings.po_approver_user_ids.includes(user.id)
          )}
          canEdit={canEdit}
          onChange={(po_approver_user_ids) => patch({ po_approver_user_ids })}
        />
      </OrgSettingsSection>

      <OrgSettingsSection
        title="Workflow preview"
        description="States and transitions for v1 (single approver)."
      >
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 font-mono text-xs text-muted-foreground">
          Draft → Submit for approval → Pending approval → Approved → Issued active
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Rejection returns the order to Draft with a reason. Pending orders appear on the dashboard
          approval queue.
        </p>
      </OrgSettingsSection>

      {canEdit && onSave ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!isDirty || isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save approval settings"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
