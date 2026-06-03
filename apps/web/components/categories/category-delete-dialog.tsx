"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deactivateSystemCategory,
  deleteSystemCategory,
} from "@/app/items/categories/actions";
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
import type { CategoryRow } from "@/lib/categories/types";
import {
  categoryDeleteBlockedWithInactiveHint,
  categoryDeleteConfirmMessage,
  getCategoryDeleteBlockers,
} from "@/lib/categories/validate-delete";

type Props = {
  category: CategoryRow | null;
  rows: CategoryRow[];
  itemCountByCategoryId: Record<string, number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (categoryId: string) => void;
};

export function CategoryDeleteDialog({
  category,
  rows,
  itemCountByCategoryId,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const blockers = useMemo(
    () =>
      category
        ? getCategoryDeleteBlockers(category.id, rows, itemCountByCategoryId)
        : [],
    [category, itemCountByCategoryId, rows]
  );

  const blocked = blockers.length > 0;
  const canMarkInactive = Boolean(category?.is_active);

  const finish = () => {
    onOpenChange(false);
    router.refresh();
  };

  const handleDelete = () => {
    if (!category || blocked) return;

    startTransition(async () => {
      const result = await deleteSystemCategory(category.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Category deleted");
      onDeleted?.(category.id);
      finish();
    });
  };

  const handleDeactivate = () => {
    if (!category || !canMarkInactive) return;

    startTransition(async () => {
      const result = await deactivateSystemCategory(category.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Category marked inactive");
      finish();
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
                categoryDeleteBlockedWithInactiveHint(blockers, !canMarkInactive)
              ) : (
                categoryDeleteConfirmMessage(category.name)
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
