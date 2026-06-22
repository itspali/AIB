"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  cancelWorkspaceDeletion,
  requestWorkspaceDeletion,
} from "@/app/settings/organization/actions";
import { GroupExitConfirmDialog } from "@/components/settings/group/group-exit-confirm-dialog";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/dashboard/format";
import type { WorkspaceDeletionStatus } from "@/lib/organization/deletion";

type Props = {
  tenantId: string;
  workspaceName: string;
  isOwner: boolean;
  parentGroupName: string | null;
  pendingDeletion: WorkspaceDeletionStatus | null;
};

export function OrganizationDangerZoneSection({
  tenantId,
  workspaceName,
  isOwner,
  parentGroupName,
  pendingDeletion,
}: Props) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);
  const [understandAcknowledged, setUnderstandAcknowledged] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isOwner) return null;

  const normalizedName = workspaceName.trim().toLowerCase();
  const canSchedule =
    confirmation.trim().toLowerCase() === normalizedName &&
    backupAcknowledged &&
    understandAcknowledged;

  const handleScheduleDeletion = () => {
    if (!canSchedule) return;

    startTransition(async () => {
      const result = await requestWorkspaceDeletion({
        confirmationName: confirmation.trim(),
        backupAcknowledged: true,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.scheduledPurgeAt
          ? `Workspace scheduled for deletion on ${formatDateTime(result.scheduledPurgeAt)}`
          : "Workspace deletion scheduled",
      );
      setDeleteOpen(false);
      setConfirmation("");
      setBackupAcknowledged(false);
      setUnderstandAcknowledged(false);
      router.refresh();
    });
  };

  const handleCancelDeletion = () => {
    startTransition(async () => {
      const result = await cancelWorkspaceDeletion();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Workspace deletion cancelled");
      router.refresh();
    });
  };

  return (
    <OrgSettingsSection
      title="Danger zone"
      description="Irreversible actions for this organization workspace."
    >
      <div className="space-y-4">
        {parentGroupName ? (
          <div className="rounded-lg border border-border p-4">
            <h4 className="text-sm font-medium">Leave enterprise group</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              This workspace belongs to <span className="font-medium text-foreground">{parentGroupName}</span>.
              Remove it from the group before deleting the workspace.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => setExitOpen(true)}
            >
              Remove from group
            </Button>
          </div>
        ) : null}

        {pendingDeletion ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <h4 className="text-sm font-medium text-destructive">Deletion scheduled</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              This workspace becomes read-only immediately and will be permanently deleted on{" "}
              <span className="font-medium text-foreground">
                {formatDateTime(pendingDeletion.scheduledPurgeAt)}
              </span>{" "}
              ({pendingDeletion.graceDays} day grace period). Export any data you need before that
              date.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              disabled={isPending}
              onClick={handleCancelDeletion}
            >
              {isPending ? "Cancelling…" : "Cancel scheduled deletion"}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <h4 className="text-sm font-medium text-destructive">Delete workspace</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Schedules permanent deletion after a platform-configured grace period. The workspace
              becomes read-only until deletion completes or you cancel.
            </p>
            <Button
              type="button"
              variant="destructive"
              className="mt-3"
              onClick={() => setDeleteOpen(true)}
            >
              Schedule workspace deletion
            </Button>
          </div>
        )}
      </div>

      <GroupExitConfirmDialog
        tenantId={tenantId}
        orgName={workspaceName}
        open={exitOpen}
        onOpenChange={setExitOpen}
        onCompleted={() => router.refresh()}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmation("");
            setBackupAcknowledged(false);
            setUnderstandAcknowledged(false);
          }
          setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule workspace deletion?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  After the grace period, all locations, inventory, documents, and settings for{" "}
                  <span className="font-medium text-foreground">{workspaceName}</span> will be
                  permanently removed.
                </p>
                <p>
                  Export or back up any data you need before the scheduled date. Full automated
                  export is not yet available — download reports and records manually from each
                  module.
                </p>
                {parentGroupName ? (
                  <p>
                    Leave <span className="font-medium text-foreground">{parentGroupName}</span>{" "}
                    before scheduling deletion.
                  </p>
                ) : null}
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="workspace_backup_ack"
                    checked={backupAcknowledged}
                    onCheckedChange={(checked) => setBackupAcknowledged(checked === true)}
                  />
                  <Label htmlFor="workspace_backup_ack" className="font-normal leading-snug">
                    I have exported or backed up the data I need, or I understand this workspace
                    has no data worth retaining.
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="workspace_understand_ack"
                    checked={understandAcknowledged}
                    onCheckedChange={(checked) => setUnderstandAcknowledged(checked === true)}
                  />
                  <Label htmlFor="workspace_understand_ack" className="font-normal leading-snug">
                    I understand the workspace will become read-only immediately and will be
                    deleted after the grace period unless I cancel.
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace_delete_confirmation">
                    Type <span className="font-medium text-foreground">{workspaceName}</span> to
                    confirm
                  </Label>
                  <Input
                    id="workspace_delete_confirmation"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder={workspaceName}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !canSchedule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handleScheduleDeletion();
              }}
            >
              {isPending ? "Scheduling…" : "Schedule deletion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OrgSettingsSection>
  );
}
