"use client";

import { Loader2 } from "lucide-react";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending: boolean;
  onConfirm: () => void;
};

export function ProductBulkArchiveAlert({
  open,
  onOpenChange,
  selectedCount,
  isPending,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive selected item masters?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                This archives {selectedCount} item master{selectedCount === 1 ? "" : "s"} and all
                linked SKU variants by setting them inactive. Historical financial lines, purchase
                orders, and sales records remain intact.
              </p>
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                Hard deletion is never attempted. Archived rows stay in storage but are excluded
                from operational flows.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={isPending} onClick={() => onConfirm()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Archive items
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
