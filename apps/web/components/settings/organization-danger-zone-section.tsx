"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteWorkspace } from "@/app/settings/organization/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  tenantId: string;
  workspaceName: string;
  isOwner: boolean;
  parentGroupName: string | null;
};

export function OrganizationDangerZoneSection({
  tenantId,
  workspaceName,
  isOwner,
  parentGroupName,
}: Props) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!isOwner) return null;

  const normalizedName = workspaceName.trim().toLowerCase();
  const canDelete = confirmation.trim().toLowerCase() === normalizedName;

  const handleDeleteWorkspace = () => {
    if (!canDelete) return;

    startTransition(async () => {
      const result = await deleteWorkspace(confirmation.trim());
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Workspace deleted");
      setDeleteOpen(false);
      setConfirmation("");

      if (result.switchedToTenantId) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      router.push("/login");
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

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <h4 className="text-sm font-medium text-destructive">Delete workspace</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently deletes this organization and all of its data. Team members lose access.
            This cannot be undone.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="mt-3"
            onClick={() => setDeleteOpen(true)}
          >
            Delete workspace
          </Button>
        </div>
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
          if (!open) setConfirmation("");
          setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  All locations, inventory, documents, and settings for{" "}
                  <span className="font-medium text-foreground">{workspaceName}</span> will be
                  permanently removed.
                </p>
                {parentGroupName ? (
                  <p>
                    Leave <span className="font-medium text-foreground">{parentGroupName}</span>{" "}
                    before deleting this workspace.
                  </p>
                ) : null}
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
              disabled={isPending || !canDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handleDeleteWorkspace();
              }}
            >
              {isPending ? "Deleting…" : "Delete workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OrgSettingsSection>
  );
}
