"use client";

import { Spinner } from "@/components/ui/spinner";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel: string;
  isPending: boolean;
  /** When true, hard-delete; otherwise soft-archive. */
  canPermanentlyDelete: boolean;
  onConfirm: () => void;
};

export function ProductItemArchiveAlert({
  open,
  onOpenChange,
  itemLabel,
  isPending,
  canPermanentlyDelete,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemLabel}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {canPermanentlyDelete ? (
                <>
                  <p>
                    This permanently removes the product and linked catalog data (variants, media,
                    tags, and channel visibility). This cannot be undone.
                  </p>
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    Permanent deletion is allowed because this item is not used in any transaction.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    This archives the product and linked variants by setting them inactive.
                    Historical financial lines, purchase orders, and sales records stay intact.
                  </p>
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                    The record is not permanently removed from storage; it is excluded from
                    operational flows. Permanent delete is blocked while the item appears on
                    transactions.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? <Spinner /> : null}
            {canPermanentlyDelete ? "Delete permanently" : "Archive item"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
