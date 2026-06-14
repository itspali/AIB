"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  approveSalesOrder,
  confirmSalesOrder,
  loadSalesOrderDetail,
  rejectSalesOrder,
  saveSalesOrder,
  submitSalesOrderForApproval,
} from "@/app/sales/orders/actions";
import { DocumentPeekApprovalPane } from "@/components/approvals/document-peek-approval-pane";
import { DocumentPeekActivityShell } from "@/components/activity/document-peek-activity-shell";
import { SoDocumentEditorShell } from "@/components/sales/orders/so-document-editor-shell";
import { SoPeekView } from "@/components/sales/orders/so-peek-view";
import { RightDrawer } from "@/components/ui/right-drawer";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";
import { notifyApprovalAlertChanged } from "@/lib/layout/approval-alert-events";
import {
  invoiceCreateFromSoHref,
  soFullPageEditHref,
} from "@/lib/sales/navigation";
import { canEditSalesOrderDocument } from "@/lib/sales/access";
import {
  copySoDraftFromOrder,
  defaultSoDraftForm,
  filterSavableSoLines,
  mapSalesOrderToDraft,
  type SoDraftFormState,
} from "@/lib/sales/orders/draft-form";
import type { SalesOrderRow } from "@/lib/sales/orders/types";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import {
  isSalesOrderApprovableByUser,
  isSoApprovalRequiredBeforeConfirm,
  type SalesApprovalSettings,
} from "@/lib/sales/approval-settings";

type Props = {
  open: boolean;
  surface: DrawerSurface;
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  peekOrder: SalesOrderRow | null;
  peekRecordId: string | null;
  editOrderId: string | null;
  onClose: () => void;
  onAfterSave: (salesOrderId: string) => void;
  onOpenEdit: (salesOrderId: string) => void;
  onEditNotAllowed: (salesOrderId: string) => void;
  editAccessGranted: boolean;
  allowLineItemDiscounts: boolean;
  defaultCurrency: string;
  preferredShippingLocationId?: string | null;
  copyFromId?: string | null;
  onDuplicate?: (salesOrderId: string) => void;
  approvalSettings: SalesApprovalSettings;
  currentUserId: string;
  isOwner: boolean;
};

function resolveDrawerTitle(surface: DrawerSurface, order: SalesOrderRow | null): string {
  if (surface === "create") return "New sales order";
  return order?.voucher_number ?? "Sales order";
}

export function SoDrawerForm({
  open,
  surface,
  locations,
  customers,
  peekOrder,
  peekRecordId,
  editOrderId,
  onClose,
  onAfterSave,
  onOpenEdit,
  onEditNotAllowed,
  editAccessGranted,
  allowLineItemDiscounts,
  defaultCurrency,
  preferredShippingLocationId = null,
  copyFromId = null,
  onDuplicate,
  approvalSettings,
  currentUserId,
  isOwner,
}: Props) {
  const readOnly = surface === "peek";
  const isMutating = isMutationSurface(surface);
  const entryLineKey = useId();
  const [form, setForm] = useState<SoDraftFormState>(() =>
    defaultSoDraftForm(locations, customers, preferredShippingLocationId, entryLineKey)
  );
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<UserFacingErrorAction | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<SalesOrderRow | null>(peekOrder);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const submitRef = useRef<() => void>(() => {});

  const resolvedPeekRecordId = surface === "peek" ? (peekOrder?.id ?? peekRecordId) : null;
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating && isDirty,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setErrorAction(null);
    setIsDirty(false);
    if (surface === "create") {
      if (!copyFromId) {
        setForm(
          defaultSoDraftForm(locations, customers, preferredShippingLocationId, entryLineKey)
        );
        setDetail(null);
      }
    } else if (surface !== "peek") {
      setForm(
        defaultSoDraftForm(locations, customers, preferredShippingLocationId, entryLineKey)
      );
      setDetail(peekOrder);
    } else if (peekOrder?.lines?.length) {
      setDetail(peekOrder);
    }
  }, [
    copyFromId,
    open,
    surface,
    peekOrder?.id,
    peekOrder?.lines?.length,
    locations,
    customers,
    preferredShippingLocationId,
    entryLineKey,
  ]);

  useEffect(() => {
    if (!open || surface !== "create" || !copyFromId) return;

    let cancelled = false;
    setDetailLoading(true);
    void loadSalesOrderDetail(copyFromId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to duplicate sales order.");
        setError(result.error);
        setForm(
          defaultSoDraftForm(locations, customers, preferredShippingLocationId, entryLineKey)
        );
        return;
      }
      setForm(copySoDraftFromOrder(result.salesOrder));
      setIsDirty(true);
    });

    return () => {
      cancelled = true;
    };
  }, [copyFromId, customers, entryLineKey, locations, open, preferredShippingLocationId, surface]);

  useEffect(() => {
    if (!open || surface !== "peek" || !resolvedPeekRecordId) return;
    if (peekOrder?.lines?.length) {
      setDetail(peekOrder);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadSalesOrderDetail(resolvedPeekRecordId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.salesOrder);
    });

    return () => {
      cancelled = true;
    };
  }, [open, peekOrder?.lines?.length, resolvedPeekRecordId, surface]);

  useEffect(() => {
    if (!open || surface !== "edit" || !editOrderId) return;

    let cancelled = false;
    setDetailLoading(true);
    void loadSalesOrderDetail(editOrderId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.salesOrder);
      setForm(mapSalesOrderToDraft(result.salesOrder));
      setIsDirty(false);
    });

    return () => {
      cancelled = true;
    };
  }, [editOrderId, open, surface]);

  const canEditThisOrder =
    detail != null
      ? canEditSalesOrderDocument(detail.commercial_status, {
          allowEditConfirmed: false,
          hasEditPermission: editAccessGranted,
        })
      : editAccessGranted;

  useEffect(() => {
    if (!open || surface !== "edit" || detailLoading || !detail?.id) return;
    if (!canEditThisOrder) onEditNotAllowed(detail.id);
  }, [canEditThisOrder, detail?.id, detailLoading, onEditNotAllowed, open, surface]);

  const patchForm = useCallback((patch: Partial<SoDraftFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setIsDirty(true);
  }, []);

  const reloadDetail = useCallback(async (orderId: string) => {
    const result = await loadSalesOrderDetail(orderId);
    if ("error" in result) return;
    setDetail(result.salesOrder);
  }, []);

  const handleSaveDraft = useCallback(() => {
    setError(null);
    setErrorAction(null);

    startTransition(async () => {
      const result = await saveSalesOrder({
        sales_order_id: editOrderId ?? detail?.id ?? null,
        customer_id: form.customer_id,
        shipping_location_id: form.shipping_location_id,
        billing_state: form.billing_state,
        shipping_state: form.shipping_state,
        source_quotation_id: form.source_quotation_id,
        custom_fields: form.custom_fields,
        lines: filterSavableSoLines(form.lines).map((line) => ({
          variant_id: line.variant_id,
          quantity_ordered: line.quantity_ordered,
          unit_price_selling: line.unit_price_selling,
          discount_percentage: line.discount_percentage,
          discount_amount: line.discount_amount,
        })),
      });

      if ("error" in result) {
        setError(result.error ?? "Unable to save sales order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }

      toast.success("Sales order saved");
      setIsDirty(false);
      await reloadDetail(result.salesOrderId);
      onAfterSave(result.salesOrderId);
    });
  }, [detail?.id, editOrderId, form, onAfterSave, reloadDetail]);

  const handleSubmitForApproval = useCallback(() => {
    const orderId = editOrderId ?? detail?.id;
    if (!orderId) return;

    startTransition(async () => {
      const result = await submitSalesOrderForApproval({ sales_order_id: orderId });
      if ("error" in result) {
        setError(result.error ?? "Unable to submit sales order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }
      toast.success("Submitted for approval");
      setIsDirty(false);
      await reloadDetail(orderId);
      onAfterSave(result.salesOrderId);
      notifyApprovalAlertChanged();
    });
  }, [detail?.id, editOrderId, onAfterSave, reloadDetail]);

  const handleConfirm = useCallback(() => {
    const orderId = editOrderId ?? detail?.id;
    if (!orderId) return;

    startTransition(async () => {
      const result = await confirmSalesOrder({ sales_order_id: orderId });
      if ("error" in result) {
        setError(result.error ?? "Unable to confirm sales order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }
      toast.success("Sales order confirmed");
      setIsDirty(false);
      await reloadDetail(orderId);
      onAfterSave(result.salesOrderId);
    });
  }, [detail?.id, editOrderId, onAfterSave, reloadDetail]);

  const handleApprove = useCallback(() => {
    const orderId = editOrderId ?? detail?.id;
    if (!orderId) return;

    startTransition(async () => {
      const result = await approveSalesOrder({ sales_order_id: orderId });
      if ("error" in result) {
        setError(result.error ?? "Unable to approve sales order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }
      toast.success(
        result.pendingNextStep
          ? "Step approved — waiting for next level."
          : "Sales order approved"
      );
      setIsDirty(false);
      await reloadDetail(orderId);
      onAfterSave(result.salesOrderId);
      notifyApprovalAlertChanged();
    });
  }, [detail?.id, editOrderId, onAfterSave, reloadDetail]);

  const handleReject = useCallback(() => {
    const orderId = editOrderId ?? detail?.id;
    if (!orderId) return;
    const notes = rejectNotes.trim();
    if (!notes) {
      toast.error("Enter a rejection reason.");
      return;
    }

    startTransition(async () => {
      const result = await rejectSalesOrder({ sales_order_id: orderId, notes });
      if ("error" in result) {
        setError(result.error ?? "Unable to reject sales order.");
        setErrorAction(result.errorAction ?? null);
        return;
      }
      toast.success("Sales order rejected");
      setRejectDialogOpen(false);
      setRejectNotes("");
      setIsDirty(false);
      await reloadDetail(orderId);
      onAfterSave(result.salesOrderId);
      notifyApprovalAlertChanged();
    });
  }, [detail?.id, editOrderId, onAfterSave, rejectNotes, reloadDetail]);

  submitRef.current = handleSaveDraft;

  useEffect(() => {
    if (!open || !isMutating) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMutating, open]);

  const salesOrderId = editOrderId ?? detail?.id ?? null;
  const isDraftOrder = detail?.commercial_status === "DRAFT" || surface === "create";
  const isPendingApprovalOrder = detail?.commercial_status === "PENDING_APPROVAL";
  const totalNetAmount = Number(detail?.total_net_amount ?? 0);
  const approvalRequiredBeforeConfirm = isSoApprovalRequiredBeforeConfirm(
    approvalSettings,
    totalNetAmount,
    currentUserId,
    { isOwner }
  );
  const showSubmitForApproval =
    isDraftOrder && editAccessGranted && approvalRequiredBeforeConfirm && salesOrderId != null;
  const showConfirm =
    isDraftOrder && editAccessGranted && !approvalRequiredBeforeConfirm && salesOrderId != null;
  const showApproveReject =
    isPendingApprovalOrder &&
    detail != null &&
    isSalesOrderApprovableByUser(detail, currentUserId, approvalSettings, { isOwner }) &&
    salesOrderId != null;
  const canCreateInvoice =
    detail?.commercial_status === "APPROVED_ACTIVE" ||
    detail?.commercial_status === "PARTIALLY_SHIPPED";

  const headerActions =
    surface === "peek" && detail ? (
      <>
        {canEditThisOrder ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Edit sales order"
              onClick={() => onOpenEdit(detail.id)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {showSubmitForApproval ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={handleSubmitForApproval}
              >
                {isPending ? "Submitting…" : "Submit for approval"}
              </Button>
            ) : null}
            {showConfirm ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={handleConfirm}
              >
                {isPending ? "Confirming…" : "Confirm"}
              </Button>
            ) : null}
            {showApproveReject ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isPending}
                  onClick={handleApprove}
                >
                  {isPending ? "Approving…" : "Approve"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setRejectDialogOpen(true)}
                >
                  Reject
                </Button>
              </>
            ) : null}
          </>
        ) : null}
        {canCreateInvoice ? (
          <Button type="button" size="sm" asChild>
            <Link href={invoiceCreateFromSoHref(detail.id)}>Create invoice</Link>
          </Button>
        ) : null}
        {editAccessGranted && onDuplicate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onDuplicate(detail.id)}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Duplicate
          </Button>
        ) : null}
      </>
    ) : isMutating ? (
      <>
        <Button
          type="button"
          size="sm"
          disabled={isPending || locations.length === 0 || customers.length === 0}
          onClick={handleSaveDraft}
          title={`${isDraftOrder ? "Save draft" : "Save"} (Ctrl+Enter)`}
        >
          {isPending ? "Saving…" : isDraftOrder ? "Save draft" : "Save"}
        </Button>
        {showSubmitForApproval ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={handleSubmitForApproval}
          >
            Submit for approval
          </Button>
        ) : null}
        {showConfirm ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
        ) : null}
      </>
    ) : null;

  const title = resolveDrawerTitle(surface, detail ?? peekOrder);

  const handleRequestClose = () => {
    if (isDirty && isMutating) {
      requestClose(onClose);
      return;
    }
    onClose();
  };

  const drawerBody = (
    <>
      {error ? (
        <UserFacingErrorMessage
          message={error}
          action={errorAction ?? undefined}
          className="mb-4 shrink-0"
        />
      ) : null}

      {detailLoading ? (
        <p className="text-sm text-muted-foreground">Loading sales order…</p>
      ) : readOnly && detail ? (
        <div className="space-y-6">
          <SoPeekView order={detail} />
          {detail.commercial_status === "PENDING_APPROVAL" ? (
            <DocumentPeekApprovalPane
              documentType="SALES_ORDER"
              documentId={detail.id}
              documentStatus={detail.commercial_status}
              voucherNumber={detail.voucher_number}
              totalNetAmount={Number(detail.total_net_amount)}
              currencyCode={defaultCurrency}
              approvalSubmittedBy={detail.approval_submitted_by}
              currentUserId={currentUserId}
              isOwner={isOwner}
              approvalSettings={approvalSettings}
              onActionComplete={() => void reloadDetail(detail.id)}
              onApprove={async () => {
                const result = await approveSalesOrder({ sales_order_id: detail.id });
                if ("error" in result) throw new Error(result.error);
                await reloadDetail(detail.id);
                onAfterSave(result.salesOrderId);
              }}
              onReject={async (notes) => {
                const result = await rejectSalesOrder({
                  sales_order_id: detail.id,
                  notes,
                });
                if ("error" in result) throw new Error(result.error);
                await reloadDetail(detail.id);
                onAfterSave(result.salesOrderId);
              }}
            />
          ) : null}
          <DocumentPeekActivityShell documentType="SALES_ORDER" documentId={detail.id} />
        </div>
      ) : isMutating ? (
        <SoDocumentEditorShell
          form={form}
          locations={locations}
          customers={customers}
          defaultCurrency={defaultCurrency}
          allowLineItemDiscounts={allowLineItemDiscounts}
          isPending={isPending}
          onPatch={patchForm}
          onLinesChange={(linesOrUpdater) => {
            setForm((current) => ({
              ...current,
              lines:
                typeof linesOrUpdater === "function"
                  ? linesOrUpdater(current.lines)
                  : linesOrUpdater,
            }));
            setIsDirty(true);
          }}
        />
      ) : null}

      {surface === "edit" && salesOrderId ? (
        <div className="mt-4">
          <Button type="button" variant="link" size="sm" className="h-auto p-0" asChild>
            <Link href={soFullPageEditHref(salesOrderId)}>Open full-page editor</Link>
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          handleRequestClose();
        }}
        onRequestClose={handleRequestClose}
        title={title}
        headerActions={headerActions}
        allowBackgroundInteraction={surface === "peek"}
        className={surface === "peek" ? "module-drawer-peek-shell" : undefined}
        bodyClassName={surface === "peek" ? "module-drawer-peek-body" : "module-drawer-form-body"}
        showCloseButton
      >
        {drawerBody}
      </RightDrawer>

      {discardDialog}

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {detail?.voucher_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The sales order returns to Draft. The submitter can edit and re-submit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="so-reject-notes">Reason</Label>
            <textarea
              id="so-reject-notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
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
    </>
  );
}
