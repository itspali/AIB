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
import { resolveActiveApprovalStep } from "@/lib/approvals/utils";
import type { DocumentApprovalRun } from "@/lib/approvals/types";
import { notifyApprovalAlertChanged } from "@/lib/layout/approval-alert-events";
import { notifyNotificationInboxChanged } from "@/lib/notifications/inbox-events";
import { formatMoneyDetail } from "@/lib/procurement/math";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import { isPurchaseOrderApprovableByUser } from "@/lib/procurement/approval-settings";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import {
  isSalesOrderApprovableByUser,
  isSalesQuoteApprovableByUser,
  isSalesInvoiceApprovableByUser,
} from "@/lib/sales/approval-settings";

export type DocumentPeekApprovalDocumentType =
  | "PURCHASE_ORDER"
  | "SALES_ORDER"
  | "SALES_QUOTATION"
  | "SALES_INVOICE";

type ApprovalSettings = ProcurementApprovalSettings | SalesApprovalSettings;

type Props = {
  documentType: DocumentPeekApprovalDocumentType;
  documentId: string;
  documentStatus: string;
  voucherNumber: string;
  totalNetAmount: number;
  currencyCode: string;
  approvalSubmittedBy?: string | null;
  currentUserId: string;
  isOwner: boolean;
  approvalSettings: ApprovalSettings;
  refreshKey?: string | number;
  onActionComplete?: () => void;
  onApprove?: () => Promise<void> | void;
  onReject?: (notes: string) => Promise<void> | void;
};

function documentTypeLabel(documentType: DocumentPeekApprovalDocumentType): string {
  switch (documentType) {
    case "PURCHASE_ORDER":
      return "purchase order";
    case "SALES_ORDER":
      return "sales order";
    case "SALES_QUOTATION":
      return "sales quotation";
    case "SALES_INVOICE":
      return "sales invoice";
    default:
      return "document";
  }
}

function isApprovableByUser(
  documentType: DocumentPeekApprovalDocumentType,
  payload: {
    document_status: string;
    total_net_amount: number;
    approval_submitted_by?: string | null;
  },
  userId: string,
  approvalSettings: ApprovalSettings,
  options: { isOwner: boolean }
): boolean {
  if (documentType === "PURCHASE_ORDER") {
    return isPurchaseOrderApprovableByUser(
      payload,
      userId,
      approvalSettings as ProcurementApprovalSettings,
      options
    );
  }

  const salesPayload = {
    commercial_status: payload.document_status,
    total_net_amount: payload.total_net_amount,
    approval_submitted_by: payload.approval_submitted_by,
  };
  const salesSettings = approvalSettings as SalesApprovalSettings;

  switch (documentType) {
    case "SALES_ORDER":
      return isSalesOrderApprovableByUser(salesPayload, userId, salesSettings, options);
    case "SALES_QUOTATION":
      return isSalesQuoteApprovableByUser(salesPayload, userId, salesSettings, options);
    case "SALES_INVOICE":
      return isSalesInvoiceApprovableByUser(salesPayload, userId, salesSettings, options);
    default:
      return false;
  }
}

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
  onApprove,
  onReject,
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
    isApprovableByUser(
      documentType,
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
  const docLabel = documentTypeLabel(documentType);

  const handleApprove = () => {
    startTransition(async () => {
      try {
        if (onApprove) {
          await onApprove();
        } else if (documentType === "PURCHASE_ORDER") {
          const result = await approvePurchaseOrder({ purchase_order_id: documentId });
          if ("error" in result) {
            toast.error(result.error ?? `Unable to approve ${docLabel}.`);
            return;
          }
          toast.success(
            result.pendingNextStep
              ? "Step approved — waiting for next level."
              : "Purchase order approved"
          );
        } else {
          toast.error(`Approval is not configured for ${docLabel}.`);
          return;
        }

        notifyApprovalAlertChanged();
        notifyNotificationInboxChanged();
        await reload();
        onActionComplete?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Unable to approve ${docLabel}.`);
      }
    });
  };

  const handleReject = () => {
    if (rejectNotes.trim().length < 3) {
      toast.error("Enter a rejection reason (at least 3 characters).");
      return;
    }

    startTransition(async () => {
      try {
        if (onReject) {
          await onReject(rejectNotes.trim());
        } else if (documentType === "PURCHASE_ORDER") {
          const result = await rejectPurchaseOrder({
            purchase_order_id: documentId,
            notes: rejectNotes.trim(),
          });
          if ("error" in result) {
            toast.error(result.error ?? `Unable to reject ${docLabel}.`);
            return;
          }
          toast.success("Purchase order rejected");
        } else {
          toast.error(`Rejection is not configured for ${docLabel}.`);
          return;
        }

        setRejectOpen(false);
        setRejectNotes("");
        notifyApprovalAlertChanged();
        notifyNotificationInboxChanged();
        await reload();
        onActionComplete?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Unable to reject ${docLabel}.`);
      }
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
              The {docLabel} returns to Draft. The submitter can edit and re-submit.
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
              placeholder={`Explain why this ${docLabel} cannot be approved…`}
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
