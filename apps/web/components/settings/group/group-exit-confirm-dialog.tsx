"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { completeGroupExit } from "@/app/settings/enterprise/actions";
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

type Props = {
  tenantId: string | null;
  orgName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function GroupExitConfirmDialog({
  tenantId,
  orgName,
  open,
  onOpenChange,
  onCompleted,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    if (!tenantId) return;

    startTransition(async () => {
      const result = await completeGroupExit(tenantId, "Spin-off from group");
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization removed from group");
      onOpenChange(false);
      onCompleted?.();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove organization from group?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{orgName ?? "This organization"}</span>{" "}
                will leave the enterprise group and become a standalone workspace.
              </p>
              <p>Re-joining later requires a new group invitation.</p>
              <p>
                Exit is blocked while stock transfers are{" "}
                <span className="font-medium text-foreground">in transit</span> for this organization.
                Complete or cancel those transfers first.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending || !tenantId} onClick={handleConfirm}>
            {isPending ? "Removing…" : "Remove from group"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
