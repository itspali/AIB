"use client";

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
import type { UomRow } from "@/lib/uom/types";

type Props = {
  row: UomRow | null;
  open: boolean;
  isDeleting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function UomDeleteDialog({
  row,
  open,
  isDeleting = false,
  onOpenChange,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete unit?</AlertDialogTitle>
          <AlertDialogDescription>
            {row ? (
              <>
                &ldquo;{row.name}&rdquo; will be removed. If it is currently assigned to any items,
                it will be deactivated instead so existing records stay intact.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? "Removing…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
