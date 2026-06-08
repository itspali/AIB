"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deactivateEntity, deleteEntity } from "@/app/entities/actions";
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
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import type { EntityListRow, EntityWorkspace } from "@/lib/entities/types";

type Props = {
  workspace: EntityWorkspace;
  entity: EntityListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (entityId: string) => void;
  onDeactivated?: (entity: EntityListRow) => void;
};

export function EntityDeleteDialog({
  workspace,
  entity,
  open,
  onOpenChange,
  onDeleted,
  onDeactivated,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const config = getEntityWorkspaceConfig(workspace);
  const canMarkInactive = Boolean(entity?.is_active);

  const handleDelete = () => {
    if (!entity) return;

    startTransition(async () => {
      const result = await deleteEntity(entity.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`${config.singularLabel} deleted`);
      onDeleted?.(entity.id);
      onOpenChange(false);
    });
  };

  const handleDeactivate = () => {
    if (!entity || !canMarkInactive) return;

    startTransition(async () => {
      const result = await deactivateEntity(entity.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`${config.singularLabel} marked inactive`);
      onDeactivated?.({
        ...entity,
        is_active: false,
      });
      onOpenChange(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {config.singularLabel.toLowerCase()}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {entity ? (
              <>
                &ldquo;{entity.name}&rdquo; will be permanently removed if no downstream documents
                reference it. If deletion is blocked, you can mark the record inactive instead.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel disabled={isPending} className="mt-0">
            Cancel
          </AlertDialogCancel>
          {canMarkInactive ? (
            <Button disabled={isPending || !entity} variant="outline" onClick={handleDeactivate}>
              {isPending ? "Saving…" : "Mark inactive"}
            </Button>
          ) : null}
          <AlertDialogAction
            disabled={isPending || !entity}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              handleDelete();
            }}
          >
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
