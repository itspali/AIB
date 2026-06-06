"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
export const DISCARD_CHANGES_TITLE = "Discard changes?";
export const DISCARD_CHANGES_DESCRIPTION = "Unsaved changes will be lost.";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

/** Shared discard confirmation for edit/create forms (drawers and full-page). */
export function DiscardChangesDialog({ open, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{DISCARD_CHANGES_TITLE}</AlertDialogTitle>
          <AlertDialogDescription>{DISCARD_CHANGES_DESCRIPTION}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="mt-2 text-destructive hover:text-destructive sm:mt-0"
            onClick={onConfirm}
          >
            Discard
          </Button>
          <AlertDialogAction className="mt-0">Keep editing</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type DiscardConfirmationOptions = {
  /** When false, closes and clears any pending discard (e.g. parent drawer closed). */
  active?: boolean;
  /** When false, close proceeds without a confirmation dialog. Defaults to true. */
  hasUnsavedChanges?: boolean;
};

/**
 * Prompt before closing an edit/create form. Use `requestClose(closeForm)` for Cancel
 * and drawer dismiss; call `closeForm` directly after a successful save.
 */
export function useDiscardChangesConfirmation({
  active = true,
  hasUnsavedChanges = true,
}: DiscardConfirmationOptions = {}) {
  const [open, setOpen] = useState(false);
  const pendingCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (active) return;
    setOpen(false);
    pendingCloseRef.current = null;
  }, [active]);

  const requestClose = useCallback(
    (onConfirm: () => void) => {
      if (!hasUnsavedChanges) {
        onConfirm();
        return;
      }
      pendingCloseRef.current = onConfirm;
      setOpen(true);
    },
    [hasUnsavedChanges]
  );

  const confirmDiscard = useCallback(() => {
    const close = pendingCloseRef.current;
    setOpen(false);
    pendingCloseRef.current = null;
    close?.();
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    if (!next) pendingCloseRef.current = null;
    setOpen(next);
  }, []);

  const discardDialog = (
    <DiscardChangesDialog open={open} onOpenChange={onOpenChange} onConfirm={confirmDiscard} />
  );

  return { requestClose, discardDialog };
}
