"use client";

import { useCallback, useEffect, useState, useTransition, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  approvePurchaseOrder,
  rejectPurchaseOrder,
} from "@/app/procurement/purchase-orders/actions";
import { ApprovalWorkflowStepper } from "@/components/approvals/approval-workflow-stepper";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fetchDocumentApprovalRunClient } from "@/lib/approvals/client-queries";
import { resolveActiveApprovalStep } from "@/lib/approvals/queries";
import type { DocumentApprovalRun } from "@/lib/approvals/types";
import { notifyApprovalAlertChanged } from "@/lib/layout/approval-alert-events";
import { notifyNotificationInboxChanged } from "@/lib/notifications/inbox-events";
import { formatMoneyDetail } from "@/lib/procurement/math";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import { isPurchaseOrderApprovableByUser } from "@/lib/procurement/approval-settings";

type Props = {
  documentType: string;
  documentId: string;
  documentStatus: string;
  voucherNumber: string;
  totalNetAmount: number;
  currencyCode: string;
  approvalSubmittedBy?: string | null;
  currentUserId: string;
  isOwner: boolean;
  approvalSettings: ProcurementApprovalSettings;
  refreshKey?: string | number;
  onActionComplete?: () => void;
};

export function DocumentPeekApprovalPane({
  documentType,
  documentId,
  documentStatus,
  voucherNumber,
  totalNetAmount,
  currencyCode,
  approvalSubmittedBy,
  currentUserId,
  isOwner,
  approvalSettings,
  refreshKey,
  onActionComplete,
}: Props) {
  const [run, setRun] = useState<DocumentApprovalRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await fetchDocumentApprovalRunClient(documentType, documentId);
    setRun(next);
    setLoading(false);
  }, [documentId, documentType]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const canApproveReject =
    documentStatus === "PENDING_APPROVAL" &&
    isPurchaseOrderApprovableByUser(
      {
        document_status: documentStatus,
        total_net_amount: totalNetAmount,
        approval_submitted_by: approvalSubmittedBy,
      },
      currentUserId,
      approvalSettings,
      { isOwner }
    );

  const activeStep = resolveActiveApprovalStep(run, currentUserId);

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approvePurchaseOrder({ purchase_order_id: documentId });
      if ("error" in result) {
        toast.error(result.error ?? "Unable to approve purchase order.");
        return;
      }
      toast.success(
        result.pendingNextStep
          ? "Step approved — waiting for next level."
          : "Purchase order approved"
      );
      notifyApprovalAlertChanged();
      notifyNotificationInboxChanged();
      await reload();
      onActionComplete?.();
    });
  };

  const handleReject = () => {
    if (rejectNotes.trim().length < 3) {
      toast.error("Enter a rejection reason (at least 3 characters).");
      return;
    }

    startTransition(async () => {
      const result = await rejectPurchaseOrder({
        purchase_order_id: documentId,
        notes: rejectNotes.trim(),
      });
      if ("error" in result) {
        toast.error(result.error ?? "Unable to reject purchase order.");
        return;
      }
      toast.success("Purchase order rejected");
      setRejectOpen(false);
      setRejectNotes("");
      notifyApprovalAlertChanged();
      notifyNotificationInboxChanged();
      await reload();
      onActionComplete?.();
    });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading approval workflow…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{voucherNumber}</p>
          <Badge variant="administrative">{documentStatus.replaceAll("_", " ")}</Badge>
          {run?.status ? <Badge variant="default">{run.status}</Badge> : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatMoneyDetail(totalNetAmount, currencyCode)}
          {run?.submitted_at
            ? ` · submitted ${new Date(run.submitted_at).toLocaleString()}`
            : ""}
        </p>
      </div>

      <ApprovalWorkflowStepper run={run} currentUserId={currentUserId} />

      {canApproveReject ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" size="sm" disabled={isPending} onClick={handleApprove}>
            {isPending ? "Working…" : activeStep ? "Approve step" : "Approve"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => setRejectOpen(true)}
          >
            Reject
          </Button>
        </div>
      ) : documentStatus === "PENDING_APPROVAL" ? (
        <p className="text-xs text-muted-foreground">
          You are not an assignee on the current approval step.
        </p>
      ) : null}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {voucherNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              The purchase order returns to Draft. The submitter can edit and re-submit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approval-reject-notes">Reason</Label>
            <textarea
              id="approval-reject-notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={rejectNotes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRejectNotes(e.target.value)}
              rows={3}
              placeholder="Explain why this order cannot be approved…"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={handleReject}>
              Reject order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
