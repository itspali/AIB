"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deactivateLocation, deleteLocation } from "@/app/settings/workspace/locations/actions";
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
import type { LocationRow } from "@/lib/locations/types";

type Props = {
  location: LocationRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function LocationDeleteDialog({ location, open, onOpenChange, onCompleted }: Props) {
  const [isPending, startTransition] = useTransition();
  const isActive = Boolean(location?.is_active);

  const handleDeactivate = () => {
    if (!location) return;

    startTransition(async () => {
      const result = await deactivateLocation(location.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to remove location.");
        return;
      }

      toast.success("Location deactivated.");
      onCompleted?.();
      onOpenChange(false);
    });
  };

  const handlePermanentDelete = () => {
    if (!location) return;

    startTransition(async () => {
      const result = await deleteLocation(location.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to delete location.");
        return;
      }

      toast.success("Location permanently deleted.");
      onCompleted?.();
      onOpenChange(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete location?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {location ? (
                <>
                  <p>
                    <span className="font-medium text-foreground">{location.name}</span> (
                    {location.code}) will be removed from your workspace.
                  </p>
                  {isActive ? (
                    <p>
                      Active locations are deactivated first. Deactivated locations stay in the
                      hierarchy but cannot receive stock or transactions. Reassign central HQ and
                      clear inventory before removal.
                    </p>
                  ) : (
                    <p>
                      This inactive location will be permanently deleted if no transactions
                      reference it. Otherwise, keep it deactivated.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel disabled={isPending} className="mt-0">
            Cancel
          </AlertDialogCancel>
          {isActive ? (
            <AlertDialogAction
              disabled={isPending || !location}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handleDeactivate();
              }}
            >
              {isPending ? "Removing…" : "Deactivate location"}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              disabled={isPending || !location}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handlePermanentDelete();
              }}
            >
              {isPending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
