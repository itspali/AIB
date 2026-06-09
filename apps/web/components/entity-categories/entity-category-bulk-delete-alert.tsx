"use client";

import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getEntityCategoryWorkspaceConfig } from "@/lib/entity-categories/config";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";

type Props = {
  workspace: EntityCategoryWorkspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending: boolean;
  onConfirm: () => void;
};

export function EntityCategoryBulkDeleteAlert({
  workspace,
  open,
  onOpenChange,
  selectedCount,
  isPending,
  onConfirm,
}: Props) {
  const { entityNounPlural } = getEntityCategoryWorkspaceConfig(workspace);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete selected categories?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                This permanently deletes {selectedCount} categor
                {selectedCount === 1 ? "y" : "ies"}. Categories with child categories or assigned{" "}
                {entityNounPlural} will be skipped.
              </p>
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                This action cannot be undone. Consider deactivating categories instead to hide them
                from entity pickers while keeping existing assignments.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => onConfirm()}
          >
            {isPending ? <Spinner /> : null}
            Delete categories
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
