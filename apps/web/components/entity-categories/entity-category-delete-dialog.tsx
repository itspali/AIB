"use client";

import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import { deactivateEntityCategory, deleteEntityCategory } from "@/app/entities/category-actions";
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
import type { EntityCategoryRow, EntityCategoryWorkspace } from "@/lib/entity-categories/types";
import {
  entityCategoryDeleteBlockedWithInactiveHint,
  entityCategoryDeleteConfirmMessage,
  getEntityCategoryDeleteBlockers,
} from "@/lib/entity-categories/validate-delete";

type Props = {
  workspace: EntityCategoryWorkspace;
  category: EntityCategoryRow | null;
  rows: EntityCategoryRow[];
  entityCountByCategoryId: Record<string, number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (categoryId: string) => void;
  onDeactivated?: (category: EntityCategoryRow) => void;
};

export function EntityCategoryDeleteDialog({
  workspace,
  category,
  rows,
  entityCountByCategoryId,
  open,
  onOpenChange,
  onDeleted,
  onDeactivated,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const blockers = useMemo(
    () =>
      category
        ? getEntityCategoryDeleteBlockers(category.id, rows, entityCountByCategoryId)
        : [],
    [category, entityCountByCategoryId, rows]
  );

  const blocked = blockers.length > 0;
  const canMarkInactive = Boolean(category?.is_active);

  const handleDelete = () => {
    if (!category || blocked) return;

    startTransition(async () => {
      const result = await deleteEntityCategory(workspace, category.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Category deleted");
      onDeleted?.(category.id);
      onOpenChange(false);
    });
  };

  const handleDeactivate = () => {
    if (!category || !canMarkInactive) return;

    startTransition(async () => {
      const result = await deactivateEntityCategory(workspace, category.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Category marked inactive");
      onDeactivated?.(result.category);
      onOpenChange(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocked
              ? canMarkInactive
                ? "Cannot delete category"
                : "Category cannot be deleted"
              : "Delete category?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {category ? (
              blocked ? (
                entityCategoryDeleteBlockedWithInactiveHint(blockers, !canMarkInactive)
              ) : (
                entityCategoryDeleteConfirmMessage(category.name)
              )
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel disabled={isPending} className="mt-0">
            Cancel
          </AlertDialogCancel>
          {blocked ? (
            canMarkInactive ? (
              <Button disabled={isPending || !category} onClick={handleDeactivate}>
                {isPending ? "Saving…" : "Mark inactive"}
              </Button>
            ) : null
          ) : (
            <AlertDialogAction
              disabled={isPending || !category}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
