"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveSalesInvoice,
  loadSalesInvoiceDetail,
  loadSalesInvoicePrefillFromOrder,
  loadSalesInvoicePrefillFromQuote,
  postSalesInvoice,
  rejectSalesInvoice,
  saveSalesInvoice,
  submitSalesInvoiceForApproval,
} from "@/app/sales/invoices/actions";
import { DocumentPrintButton } from "@/components/documents/document-print-button";
import { DocumentPeekApprovalPane } from "@/components/approvals/document-peek-approval-pane";
import { DocumentPeekActivityShell } from "@/components/activity/document-peek-activity-shell";
import { InvoiceDocumentEditorShell } from "@/components/sales/invoices/invoice-document-editor-shell";
import { InvoicePaymentPanel } from "@/components/sales/invoices/invoice-payment-panel";
import { InvoicePeekView } from "@/components/sales/invoices/invoice-peek-view";
import {
  SalesDocumentLinkPanel,
  toSalesDocumentLinkRef,
} from "@/components/sales/shared/sales-document-link-panel";
import { RightDrawer } from "@/components/ui/right-drawer";
import { useModuleDrawerPeekPresentation } from "@/lib/layout/use-module-drawer-peek-presentation";
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
import { Label } from "@/components/ui/label";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import {
  defaultInvoiceDraftForm,
  filterSavableInvoiceLines,
  mapSalesInvoiceToDraft,
  type InvoiceDraftFormState,
} from "@/lib/sales/invoices/draft-form";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";
import { canEditSalesDocument } from "@/lib/sales/shared/document-status";
import type { DrawerSurface } from "@/lib/layout/module-drawer-url";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { DEFAULT_SALES_INVOICE_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import { resolveSalesDraftLineUomCodeForSave } from "@/lib/sales/shared/sales-line-uom-options";
import { buildSalesCommerceSaveExtras } from "@/lib/sales/shared/sales-commerce-save-extras";
import { resolveSalesCommerceSupplyStates } from "@/lib/sales/shared/sales-commerce-draft";
import { useSalesDrawerFormLayout } from "@/lib/sales/shared/sales-drawer-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import {
  isInvoiceApprovalRequiredBeforePost,
  isSalesInvoiceApprovableByUser,
  isSalesInvoicePostableByUser,
} from "@/lib/sales/approval-settings";
import { mapInvoiceLinesForApprovalRules } from "@/lib/sales/evaluate-sales-approval-rules";
import { notifyApprovalAlertChanged } from "@/lib/layout/approval-alert-events";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  surface: DrawerSurface;
  customers: CustomerOption[];
  locations: SalesLocationOption[];
  peekInvoice: SalesInvoiceRow | null;
  peekRecordId: string | null;
  editInvoiceId: string | null;
  createPrefillSoId?: string | null;
  createPrefillQuoteId?: string | null;
  editAccessGranted: boolean;
  defaultCurrency?: string;
  documentLayout?: DocumentLayoutTemplate;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  allowLineItemDiscounts?: boolean;
  allowTransactionDiscounts?: boolean;
  tenantCountry?: string | null;
  gstRegistered?: boolean;
  approvalSettings: SalesApprovalSettings;
  currentUserId: string;
  isOwner: boolean;
  onClose: () => void;
  onAfterSave: (invoiceId: string) => void;
  onOpenEdit?: (invoiceId: string) => void;
};

export function InvoiceDrawerForm({
  open,
  surface,
  customers,
  locations,
  peekInvoice,
  peekRecordId,
  editInvoiceId,
  createPrefillSoId = null,
  createPrefillQuoteId = null,
  editAccessGranted,
  defaultCurrency = "USD",
  documentLayout = DEFAULT_SALES_INVOICE_SCREEN_LAYOUT,
  taxCodeOptions = [],
  allowLineItemDiscounts = true,
  allowTransactionDiscounts = false,
  tenantCountry = null,
  gstRegistered = false,
  approvalSettings,
  currentUserId,
  isOwner,
  onClose,
  onAfterSave,
  onOpenEdit,
}: Props) {
  const readOnly = surface === "peek";
  const isEditing = surface === "edit";
  const isCreating = surface === "create";
  const isMutating = isCreating || isEditing;
  const { peekShellClassName, peekBodyClassName } = useModuleDrawerPeekPresentation(
    surface === "peek"
  );
  const { lineTableFillHeight, useDrawerBodyScroll } = useSalesDrawerFormLayout(isMutating);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const entryLineKey = useId();
  const [form, setForm] = useState<InvoiceDraftFormState>(() =>
    defaultInvoiceDraftForm(locations, customers, null, entryLineKey, defaultCurrency)
  );
  const [detail, setDetail] = useState<SalesInvoiceRow | null>(peekInvoice);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const resolvedPeekRecordId = surface === "peek" ? (peekInvoice?.id ?? peekRecordId) : null;

  useEffect(() => {
    if (!open) return;
    if (isCreating) {
      if (createPrefillSoId) {
        setDetailLoading(true);
        loadSalesInvoicePrefillFromOrder(createPrefillSoId)
          .then((result) => {
            if ("error" in result) {
              setError(result.error ?? "Unable to load prefill.");
              setForm(
                defaultInvoiceDraftForm(
                  locations,
                  customers,
                  null,
                  entryLineKey,
                  defaultCurrency
                )
              );
              return;
            }
            setForm(result.draft);
          })
          .finally(() => setDetailLoading(false));
      } else if (createPrefillQuoteId) {
        setDetailLoading(true);
        loadSalesInvoicePrefillFromQuote(createPrefillQuoteId)
          .then((result) => {
            if ("error" in result) {
              setError(result.error ?? "Unable to load prefill.");
              setForm(
                defaultInvoiceDraftForm(
                  locations,
                  customers,
                  null,
                  entryLineKey,
                  defaultCurrency
                )
              );
              return;
            }
            setForm(result.draft);
          })
          .finally(() => setDetailLoading(false));
      } else {
        setForm(
          defaultInvoiceDraftForm(locations, customers, null, entryLineKey, defaultCurrency)
        );
      }
      setDetail(null);
      setError(null);
      return;
    }
    if (surface === "peek") return;

    const invoiceId = editInvoiceId ?? peekRecordId;
    if (!invoiceId) return;

    setDetailLoading(true);
    loadSalesInvoiceDetail(invoiceId)
      .then((result) => {
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setDetail(result.invoice);
        if (isEditing) setForm(mapSalesInvoiceToDraft(result.invoice, defaultCurrency));
      })
      .finally(() => setDetailLoading(false));
  }, [
    open,
    surface,
    isCreating,
    isEditing,
    editInvoiceId,
    peekRecordId,
    createPrefillSoId,
    createPrefillQuoteId,
    locations,
    customers,
    entryLineKey,
    defaultCurrency,
  ]);

  useEffect(() => {
    if (!open || surface !== "peek" || !resolvedPeekRecordId) return;
    if (peekInvoice?.lines?.length) {
      setDetail(peekInvoice);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadSalesInvoiceDetail(resolvedPeekRecordId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.invoice);
    });

    return () => {
      cancelled = true;
    };
  }, [open, peekInvoice, peekInvoice?.lines?.length, resolvedPeekRecordId, surface]);

  const patchForm = useCallback((patch: Partial<InvoiceDraftFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const reloadInvoiceDetail = useCallback(async (invoiceId: string) => {
    const result = await loadSalesInvoiceDetail(invoiceId);
    if ("invoice" in result) {
      setDetail(result.invoice);
    }
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      const savableLines = filterSavableInvoiceLines(form.lines);
      if (savableLines.length === 0) {
        setError("Add at least one complete line.");
        return;
      }

      const supplyStates = resolveSalesCommerceSupplyStates({
        customers,
        locations,
        customerId: form.customer_id,
        originLocationId: form.origin_location_id,
        billingState: form.billing_state,
        shippingState: form.shipping_state,
      });
      const result = await saveSalesInvoice({
        sales_invoice_id: editInvoiceId,
        customer_id: form.customer_id,
        origin_location_id: form.origin_location_id,
        billing_state: supplyStates.billing_state,
        shipping_state: supplyStates.shipping_state,
        source_order_id: form.source_order_id,
        source_quotation_id: form.source_quotation_id,
        custom_fields: form.custom_fields,
        lines: savableLines.map((line) => ({
          variant_id: line.variant_id,
          quantity_invoiced: line.quantity_invoiced,
          unit_price_selling: line.unit_price_selling,
          discount_percentage: line.discount_percentage,
          discount_amount: line.discount_amount,
          source_order_line_id: line.source_order_line_id,
          source_quotation_line_id: line.source_quotation_line_id,
          uom_code: resolveSalesDraftLineUomCodeForSave(line),
        })),
        ...buildSalesCommerceSaveExtras(form, savableLines, {
          allowTransactionDiscounts,
        }),
      });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      toast.success(editInvoiceId ? "Invoice updated." : "Invoice saved.");
      onAfterSave(result.salesInvoiceId!);
    });
  };

  const invoiceId = editInvoiceId ?? detail?.id ?? null;
  const isDraftInvoice = detail?.commercial_status === "DRAFT" || surface === "create";
  const isPendingApprovalInvoice = detail?.commercial_status === "PENDING_APPROVAL";
  const totalNetAmount = Number(detail?.total_net_amount ?? 0);
  const approvalRequiredBeforePost = isInvoiceApprovalRequiredBeforePost(
    approvalSettings,
    totalNetAmount,
    currentUserId,
    { isOwner },
    mapInvoiceLinesForApprovalRules(detail?.lines)
  );
  const showSubmitForApproval =
    isDraftInvoice && editAccessGranted && approvalRequiredBeforePost && invoiceId != null;
  const showPostInvoice =
    detail != null &&
    editAccessGranted &&
    invoiceId != null &&
    isSalesInvoicePostableByUser(detail, approvalSettings, currentUserId, {
      isOwner,
      editAccessGranted,
    });
  const showApproveReject =
    isPendingApprovalInvoice &&
    detail != null &&
    isSalesInvoiceApprovableByUser(detail, currentUserId, approvalSettings, { isOwner }) &&
    invoiceId != null;

  const handleSubmitForApproval = useCallback(() => {
    if (!invoiceId) return;
    startTransition(async () => {
      setError(null);
      const result = await submitSalesInvoiceForApproval({ sales_invoice_id: invoiceId });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Submitted for approval");
      await reloadInvoiceDetail(invoiceId);
      onAfterSave(invoiceId);
      notifyApprovalAlertChanged();
    });
  }, [invoiceId, onAfterSave, reloadInvoiceDetail]);

  const handlePostInvoice = useCallback(() => {
    if (!invoiceId) return;
    startTransition(async () => {
      setError(null);
      const result = await postSalesInvoice({ sales_invoice_id: invoiceId });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Invoice posted");
      await reloadInvoiceDetail(invoiceId);
      onAfterSave(invoiceId);
    });
  }, [invoiceId, onAfterSave, reloadInvoiceDetail]);

  const handleApprove = useCallback(() => {
    if (!invoiceId) return;
    startTransition(async () => {
      setError(null);
      const result = await approveSalesInvoice({ sales_invoice_id: invoiceId });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Invoice approved");
      await reloadInvoiceDetail(invoiceId);
      onAfterSave(invoiceId);
      notifyApprovalAlertChanged();
    });
  }, [invoiceId, onAfterSave, reloadInvoiceDetail]);

  const handleReject = useCallback(() => {
    if (!invoiceId) return;
    const notes = rejectNotes.trim();
    if (!notes) {
      toast.error("Enter a rejection reason.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await rejectSalesInvoice({ sales_invoice_id: invoiceId, notes });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Invoice rejected");
      setRejectDialogOpen(false);
      setRejectNotes("");
      await reloadInvoiceDetail(invoiceId);
      onAfterSave(invoiceId);
      notifyApprovalAlertChanged();
    });
  }, [invoiceId, onAfterSave, rejectNotes, reloadInvoiceDetail]);

  const draftNextStepHint =
    detail?.commercial_status === "DRAFT"
      ? approvalRequiredBeforePost
        ? "Submit for approval when ready. Once approved, post the invoice to finalize it."
        : "Post the invoice when ready to finalize it and record receivables."
      : isPendingApprovalInvoice && detail.approval_workflow_complete
        ? "Approval is complete. Post the invoice to finalize it."
        : null;

  const renderWorkflowActions = () => (
    <>
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
      {showPostInvoice ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={handlePostInvoice}
        >
          {isPending ? "Posting…" : "Post invoice"}
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
  );

  const title =
    surface === "create"
      ? "New invoice"
      : surface === "edit"
        ? "Edit invoice"
        : detail?.invoice_number ?? "Invoice";

  const headerActions =
    surface === "peek" && detail ? (
      <>
        {editAccessGranted && canEditSalesDocument(detail.commercial_status) ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenEdit?.(detail.id)}
            >
              Edit
            </Button>
            {renderWorkflowActions()}
          </>
        ) : null}
        {detail.commercial_status === "APPROVED_ACTIVE" ||
        detail.commercial_status === "FULLY_COMPLETED" ? (
          <DocumentPrintButton
            moduleKey="SALES_INVOICE"
            documentId={detail.id}
            documentLocationId={detail.origin_location_id}
            label="Tax invoice"
          />
        ) : null}
      </>
    ) : isMutating ? (
      <>
        <Button type="button" size="sm" disabled={isPending || detailLoading} onClick={handleSave}>
          {isPending ? "Saving…" : "Save draft"}
        </Button>
        {invoiceId ? renderWorkflowActions() : null}
      </>
    ) : null;

  const drawerBody = (
    <>
      {error ? <UserFacingErrorMessage message={error} className="mb-4 shrink-0" /> : null}
      {readOnly ? (
        detailLoading ? (
          <p className="text-sm text-muted-foreground">Loading invoice…</p>
        ) : detail ? (
          <DocumentPeekActivityShell
            entityType="SALES_INVOICE"
            entityId={detail.id}
            refreshKey={`${detail.id}:${detail.updated_at}`}
            showApprovalPane={detail.commercial_status === "PENDING_APPROVAL"}
            approvalPane={
              <DocumentPeekApprovalPane
                documentType="SALES_INVOICE"
                documentId={detail.id}
                documentStatus={detail.commercial_status}
                voucherNumber={detail.invoice_number}
                totalNetAmount={Number(detail.total_net_amount)}
                currencyCode={defaultCurrency}
                approvalSubmittedBy={detail.approval_submitted_by}
                currentUserId={currentUserId}
                isOwner={isOwner}
                approvalSettings={approvalSettings}
                onActionComplete={() => void reloadInvoiceDetail(detail.id)}
                onApprove={async () => {
                  const result = await approveSalesInvoice({ sales_invoice_id: detail.id });
                  if ("error" in result) throw new Error(result.error);
                  await reloadInvoiceDetail(detail.id);
                  onAfterSave(detail.id);
                }}
                onReject={async (notes) => {
                  const result = await rejectSalesInvoice({
                    sales_invoice_id: detail.id,
                    notes,
                  });
                  if ("error" in result) throw new Error(result.error);
                  await reloadInvoiceDetail(detail.id);
                  onAfterSave(detail.id);
                }}
              />
            }
          >
            <div className="space-y-4">
              {draftNextStepHint ? (
                <p className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  {draftNextStepHint}
                </p>
              ) : null}
              <InvoicePeekView
                invoice={detail}
                layout={documentLayout}
                allowLineItemDiscounts={allowLineItemDiscounts}
                customers={customers}
                locations={locations}
              />
              <SalesDocumentLinkPanel
                documentType="invoice"
                documentId={detail.id}
                customerId={detail.customer_id}
                editAccessGranted={editAccessGranted}
                sourceOrder={toSalesDocumentLinkRef(
                  "sales_order",
                  detail.source_order_id,
                  detail.source_order_number
                )}
                sourceQuote={toSalesDocumentLinkRef(
                  "quote",
                  detail.source_quotation_id,
                  detail.source_quotation_number
                )}
                onLinked={() => void reloadInvoiceDetail(detail.id)}
              />
              {detail.commercial_status === "APPROVED_ACTIVE" ? (
                <InvoicePaymentPanel
                  salesInvoiceId={detail.id}
                  customerId={detail.customer_id}
                  invoiceNetAmount={detail.total_net_amount}
                  totalPaidAmount={detail.total_paid_amount}
                  invoicePaymentStatus={detail.invoice_payment_status}
                  onApplied={() => {
                    void loadSalesInvoiceDetail(detail.id).then((result) => {
                      if ("invoice" in result) setDetail(result.invoice);
                    });
                  }}
                />
              ) : null}
            </div>
          </DocumentPeekActivityShell>
        ) : (
          <p className="text-sm text-muted-foreground">Invoice not found.</p>
        )
      ) : detailLoading ? (
        <p className="text-sm text-muted-foreground">Loading prefill…</p>
      ) : (
        <InvoiceDocumentEditorShell
          form={form}
          locations={locations}
          customers={customers}
          defaultCurrency={defaultCurrency}
          documentLayout={documentLayout}
          allowLineItemDiscounts={allowLineItemDiscounts}
          allowTransactionDiscounts={allowTransactionDiscounts}
          taxCodeOptions={taxCodeOptions}
          tenantCountry={tenantCountry}
          gstRegistered={gstRegistered}
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
          }}
        />
      )}
    </>
  );

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose(onClose);
        }}
        onRequestClose={() => requestClose(onClose)}
        title={title}
        headerActions={headerActions}
        widthPolicy={surface === "peek" ? "peek" : "document"}
        allowBackgroundInteraction={surface === "peek"}
        peekMode={surface === "peek"}
        className={peekShellClassName}
        bodyClassName={
          surface === "peek"
            ? peekBodyClassName
            : isMutating
              ? cn(
                  "module-drawer-form-body",
                  useDrawerBodyScroll && "module-drawer-form-body-scroll"
                )
              : undefined
        }
        scrollable={useDrawerBodyScroll || !(isMutating && lineTableFillHeight)}
        showCloseButton
      >
        <div className={cn(isMutating && useDrawerBodyScroll && "shrink-0 pb-6")}>{drawerBody}</div>
      </RightDrawer>
      {discardDialog}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {detail?.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice returns to Draft. The submitter can edit and re-submit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="invoice-reject-notes">Reason</Label>
            <textarea
              id="invoice-reject-notes"
              className="glass-form-control flex min-h-[80px] w-full"
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              rows={3}
              placeholder="Explain why this invoice cannot be approved…"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={handleReject}>
              Reject invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
