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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Props = {
  open: boolean;
  pendingCount: number;
  isSaving: boolean;
  reroutePending: boolean;
  onReroutePendingChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ApprovalSettingsSaveDialog({
  open,
  pendingCount,
  isSaving,
  reroutePending,
  onReroutePendingChange,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pending approvals may be affected</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                You have{" "}
                <span className="font-medium text-foreground">
                  {pendingCount} purchase order{pendingCount === 1 ? "" : "s"}
                </span>{" "}
                waiting for approval. Saving will change who can approve and how approval works.
              </p>
              <div className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="reroute-pending" className="text-sm text-foreground">
                      Update waiting orders too
                    </Label>
                    <p className="text-xs">
                      Rebuilds in-flight approvals from scratch. Progress already collected will
                      be cleared.
                    </p>
                  </div>
                  <Switch
                    id="reroute-pending"
                    checked={reroutePending}
                    disabled={isSaving}
                    onCheckedChange={onReroutePendingChange}
                  />
                </div>
              </div>
              {!reroutePending ? (
                <p className="text-xs">
                  Recommended: leave off so only new purchase orders use the updated settings.
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving} onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction disabled={isSaving} onClick={onConfirm}>
            {isSaving ? "Saving…" : "Save settings"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
