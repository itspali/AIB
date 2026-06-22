"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteTenantGroup } from "@/app/settings/group/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  groupId: string | null;
  groupName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GroupDeleteConfirmDialog({ groupId, groupName, open, onOpenChange }: Props) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  const normalizedName = groupName?.trim().toLowerCase() ?? "";
  const canConfirm = Boolean(groupId && confirmation.trim().toLowerCase() === normalizedName);

  const handleConfirm = () => {
    if (!groupId || !canConfirm) return;

    startTransition(async () => {
      const result = await deleteTenantGroup(groupId);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Enterprise group deleted");
      setConfirmation("");
      onOpenChange(false);
      router.push("/settings/organization");
      router.refresh();
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmation("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete enterprise group?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This permanently removes the group shell{" "}
                <span className="font-medium text-foreground">{groupName ?? "—"}</span>. Individual
                organization workspaces are not deleted, but every organization must leave the
                group first and pending invitations must be revoked.
              </p>
              <div className="space-y-2">
                <Label htmlFor="group_delete_confirmation">
                  Type <span className="font-medium text-foreground">{groupName}</span> to confirm
                </Label>
                <Input
                  id="group_delete_confirmation"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={groupName ?? "Group name"}
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending || !canConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {isPending ? "Deleting…" : "Delete group"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
