"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  approveSalesQuotation,
  confirmSalesQuotation,
  convertQuotationToInvoice,
  convertQuotationToOrder,
  loadSalesQuotationDetail,
  rejectSalesQuotation,
  resolveQuoteSendRecipientEmail,
  saveSalesQuotation,
  sendSalesQuotation,
  submitSalesQuotationForApproval,
} from "@/app/sales/quotes/actions";
import { DocumentPrintButton } from "@/components/documents/document-print-button";
import { DocumentPeekApprovalPane } from "@/components/approvals/document-peek-approval-pane";
import { DocumentPeekActivityShell } from "@/components/activity/document-peek-activity-shell";
import { QuoteDocumentEditorShell } from "@/components/sales/quotes/quote-document-editor-shell";
import { QuotePeekView } from "@/components/sales/quotes/quote-peek-view";
import {
  SalesDocumentLinkPanel,
  toSalesDocumentLinkRef,
} from "@/components/sales/shared/sales-document-link-panel";
import {
  SalesDocumentConversionConfirmDialog,
  type SalesDocumentConversionKind,
} from "@/components/sales/shared/sales-document-conversion-confirm-dialog";
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
import { RightDrawer } from "@/components/ui/right-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import { notifyApprovalAlertChanged } from "@/lib/layout/approval-alert-events";
import {
  defaultQuoteDraftForm,
  filterSavableQuoteLines,
  mapSalesQuoteToDraft,
  type QuoteDraftFormState,
} from "@/lib/sales/quotes/draft-form";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
import type { SalesDocumentConversionMode } from "@/lib/sales/document-conversion-settings";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import {
  isQuoteApprovalRequiredBeforeConfirm,
  isSalesQuoteApprovableByUser,
  isSalesQuoteConfirmableByUser,
  isSalesQuoteSendableByUser,
} from "@/lib/sales/approval-settings";
import { mapQuoteLinesForApprovalRules } from "@/lib/sales/evaluate-sales-approval-rules";
import {
  invoiceCreateFromQuoteHref,
  SALES_INVOICES_HREF,
  SALES_ORDERS_HREF,
  soCreateFromQuoteHref,
} from "@/lib/sales/navigation";
import { canEditSalesDocument } from "@/lib/sales/shared/document-status";
import type { DrawerSurface } from "@/lib/layout/module-drawer-url";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import { buildSalesCommerceSaveExtras } from "@/lib/sales/shared/sales-commerce-save-extras";
import { resolveSalesDraftLineUomCodeForSave } from "@/lib/sales/shared/sales-line-uom-options";
import { resolveSalesCommerceSupplyStates } from "@/lib/sales/shared/sales-commerce-draft";
import { useSalesDrawerFormLayout } from "@/lib/sales/shared/sales-drawer-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  surface: DrawerSurface;
  customers: CustomerOption[];
  locations: SalesLocationOption[];
  peekQuote: SalesQuoteRow | null;
  peekRecordId: string | null;
  editQuoteId: string | null;
  editAccessGranted: boolean;
  defaultCurrency?: string;
  documentLayout?: DocumentLayoutTemplate;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  allowLineItemDiscounts?: boolean;
  allowTransactionDiscounts?: boolean;
  tenantCountry?: string | null;
  gstRegistered?: boolean;
  preferredOriginLocationId?: string | null;
  documentConversionMode?: SalesDocumentConversionMode;
  approvalSettings: SalesApprovalSettings;
  currentUserId: string;
  isOwner: boolean;
  onClose: () => void;
  onAfterSave: (quoteId: string) => void;
  onOpenEdit?: (quoteId: string) => void;
};

export function QuoteDrawerForm({
  open,
  surface,
  customers,
  locations,
  peekQuote,
  peekRecordId,
  editQuoteId,
  editAccessGranted,
  defaultCurrency = "USD",
  documentLayout = DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT,
  taxCodeOptions = [],
  allowLineItemDiscounts = true,
  allowTransactionDiscounts = false,
  tenantCountry = null,
  gstRegistered = false,
  preferredOriginLocationId = null,
  documentConversionMode = "prefill_form",
  approvalSettings,
  currentUserId,
  isOwner,
  onClose,
  onAfterSave,
  onOpenEdit,
}: Props) {
  const router = useRouter();
  const readOnly = surface === "peek";
  const isEditing = surface === "edit";
  const isCreating = surface === "create";
  const isMutating = isCreating || isEditing;
  const { lineTableFillHeight, useDrawerBodyScroll } = useSalesDrawerFormLayout(isMutating);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });

  const entryLineKey = useId();
  const [form, setForm] = useState<QuoteDraftFormState>(() =>
    defaultQuoteDraftForm(
      locations,
      customers,
      preferredOriginLocationId,
      entryLineKey,
      defaultCurrency
    )
  );
  const [detail, setDetail] = useState<SalesQuoteRow | null>(peekQuote);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendToEmail, setSendToEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [conversionKind, setConversionKind] = useState<SalesDocumentConversionKind | null>(null);
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);

  const resolvedPeekRecordId = surface === "peek" ? (peekQuote?.id ?? peekRecordId) : null;

  useEffect(() => {
    if (!open) return;
    if (isCreating) {
      setForm(
        defaultQuoteDraftForm(
          locations,
          customers,
          preferredOriginLocationId,
          entryLineKey,
          defaultCurrency
        )
      );
      setDetail(null);
      setError(null);
      return;
    }
    if (surface === "peek") return;

    const quoteId = editQuoteId ?? peekRecordId;
    if (!quoteId) return;

    setDetailLoading(true);
    loadSalesQuotationDetail(quoteId)
      .then((result) => {
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setDetail(result.quote);
        if (isEditing) {
          setForm(mapSalesQuoteToDraft(result.quote, defaultCurrency));
        }
      })
      .finally(() => setDetailLoading(false));
  }, [
    open,
    surface,
    isCreating,
    isEditing,
    editQuoteId,
    peekRecordId,
    locations,
    customers,
    preferredOriginLocationId,
    entryLineKey,
    defaultCurrency,
  ]);

  useEffect(() => {
    if (!open || surface !== "peek" || !resolvedPeekRecordId) return;
    if (peekQuote?.lines?.length) {
      setDetail(peekQuote);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadSalesQuotationDetail(resolvedPeekRecordId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.quote);
    });

    return () => {
      cancelled = true;
    };
  }, [open, peekQuote, peekQuote?.lines?.length, resolvedPeekRecordId, surface]);

  const patchForm = useCallback((patch: Partial<QuoteDraftFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const handleLinesChange = useCallback(
    (linesOrUpdater: QuoteDraftFormState["lines"] | ((current: QuoteDraftFormState["lines"]) => QuoteDraftFormState["lines"])) => {
      setForm((current) => ({
        ...current,
        lines:
          typeof linesOrUpdater === "function"
            ? linesOrUpdater(current.lines)
            : linesOrUpdater,
      }));
    },
    []
  );

  const reloadQuoteDetail = useCallback(async (quoteId: string) => {
    const result = await loadSalesQuotationDetail(quoteId);
    if ("quote" in result) {
      setDetail(result.quote);
    }
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      const savableLines = filterSavableQuoteLines(form.lines);
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
      const result = await saveSalesQuotation({
        sales_quotation_id: editQuoteId ?? detail?.id ?? null,
        customer_id: form.customer_id,
        origin_location_id: form.origin_location_id || null,
        billing_state: supplyStates.billing_state,
        shipping_state: supplyStates.shipping_state,
        valid_until: form.valid_until,
        custom_fields: form.custom_fields,
        lines: savableLines.map((line) => ({
          variant_id: line.variant_id,
          quantity_quoted: line.quantity_quoted,
          unit_price_selling: line.unit_price_selling,
          discount_percentage: line.discount_percentage,
          discount_amount: line.discount_amount,
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

      toast.success(editQuoteId ? "Quote updated." : "Quote saved.");
      onAfterSave(result.quotationId!);
    });
  };


  const quoteId = editQuoteId ?? detail?.id ?? null;
  const isDraftQuote = detail?.commercial_status === "DRAFT" || surface === "create";
  const isPendingApprovalQuote = detail?.commercial_status === "PENDING_APPROVAL";
  const totalNetAmount = Number(detail?.total_net_amount ?? 0);
  const approvalRequiredBeforeIssue = isQuoteApprovalRequiredBeforeConfirm(
    approvalSettings,
    totalNetAmount,
    currentUserId,
    { isOwner },
    mapQuoteLinesForApprovalRules(detail?.lines)
  );
  const showSubmitForApproval =
    isDraftQuote && editAccessGranted && approvalRequiredBeforeIssue && quoteId != null;
  const showConfirm =
    detail != null &&
    editAccessGranted &&
    quoteId != null &&
    isSalesQuoteConfirmableByUser(detail, approvalSettings, currentUserId, {
      isOwner,
      editAccessGranted,
    });
  const showSend =
    detail != null &&
    quoteId != null &&
    isSalesQuoteSendableByUser(detail, { editAccessGranted });
  const showApproveReject =
    isPendingApprovalQuote &&
    detail != null &&
    isSalesQuoteApprovableByUser(detail, currentUserId, approvalSettings, { isOwner }) &&
    quoteId != null;
  const canConvertQuote = detail?.commercial_status === "APPROVED_ACTIVE";

  const handleSubmitForApproval = useCallback(() => {
    if (!quoteId) return;
    startTransition(async () => {
      setError(null);
      const result = await submitSalesQuotationForApproval({ quotation_id: quoteId });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      toast.success("Submitted for approval");
      await reloadQuoteDetail(quoteId);
      onAfterSave(quoteId);
      notifyApprovalAlertChanged();
    });
  }, [onAfterSave, quoteId, reloadQuoteDetail]);

  const handleConfirm = useCallback(() => {
    if (!quoteId) return;
    startTransition(async () => {
      setError(null);
      const result = await confirmSalesQuotation({ quotation_id: quoteId });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      toast.success("Quote confirmed");
      await reloadQuoteDetail(quoteId);
      onAfterSave(quoteId);
    });
  }, [onAfterSave, quoteId, reloadQuoteDetail]);

  const openSendDialog = useCallback(() => {
    if (!quoteId) return;
    setSendDialogOpen(true);
    void resolveQuoteSendRecipientEmail(quoteId).then((result) => {
      if ("email" in result && result.email) {
        setSendToEmail(result.email);
      }
    });
  }, [quoteId]);

  const handleSendQuotation = useCallback(
    (sendChannel: "EMAIL" | "MANUAL") => {
      if (!quoteId) return;
      startTransition(async () => {
        setError(null);
        const result = await sendSalesQuotation({
          quotation_id: quoteId,
          sent_to_email: sendChannel === "EMAIL" ? sendToEmail.trim() : null,
          send_channel: sendChannel,
        });
        if ("error" in result && result.error) {
          setError(result.error);
          if (sendChannel === "EMAIL" && "notConfigured" in result && result.notConfigured) {
            toast.error(result.error);
          }
          return;
        }
        toast.success(
          detail?.sent_at ? "Quotation resent to customer." : "Quotation sent to customer."
        );
        setSendDialogOpen(false);
        await reloadQuoteDetail(quoteId);
        onAfterSave(quoteId);
      });
    },
    [detail?.sent_at, onAfterSave, quoteId, reloadQuoteDetail, sendToEmail]
  );

  const handleApprove = useCallback(() => {
    if (!quoteId) return;
    startTransition(async () => {
      setError(null);
      const result = await approveSalesQuotation({ quotation_id: quoteId });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      toast.success(
        "success" in result && result.pendingNextStep
          ? "Step approved — confirm the quote once approval is complete."
          : "Quote approved — confirm it before sending to the customer."
      );
      await reloadQuoteDetail(quoteId);
      onAfterSave(quoteId);
      notifyApprovalAlertChanged();
    });
  }, [onAfterSave, quoteId, reloadQuoteDetail]);

  const handleReject = useCallback(() => {
    if (!quoteId) return;
    const notes = rejectNotes.trim();
    if (!notes) {
      toast.error("Enter a rejection reason.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await rejectSalesQuotation({ quotation_id: quoteId, notes });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      toast.success("Quote rejected");
      setRejectDialogOpen(false);
      setRejectNotes("");
      await reloadQuoteDetail(quoteId);
      onAfterSave(quoteId);
      notifyApprovalAlertChanged();
    });
  }, [onAfterSave, quoteId, rejectNotes, reloadQuoteDetail]);

  const draftNextStepHint =
    detail?.commercial_status === "DRAFT"
      ? approvalRequiredBeforeIssue
        ? "Submit for approval when ready. Once approved, confirm the quote, then send it to your customer or convert it."
        : "Confirm the quote when ready, then send it to your customer or convert it to an order or invoice."
      : detail?.commercial_status === "PENDING_APPROVAL" && detail.approval_workflow_complete
        ? "Approval complete — confirm the quote, then send it to your customer."
        : detail?.commercial_status === "APPROVED_ACTIVE" && !detail.sent_at
          ? "Quote is confirmed — send it to your customer or convert it to an order or invoice."
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
      {showSend ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={openSendDialog}
        >
          {detail?.sent_at ? "Resend quotation" : "Send quotation"}
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

  const renderConvertActions = () => (
    <>
      {canConvertQuote && detail && !detail.converted_to_order_id ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleQuoteConversion("quote_to_order")}
        >
          Convert to order
        </Button>
      ) : null}
      {canConvertQuote && detail && !detail.converted_to_invoice_id ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleQuoteConversion("quote_to_invoice")}
        >
          Convert to invoice
        </Button>
      ) : null}
    </>
  );

  const handleQuoteConversion = (kind: "quote_to_order" | "quote_to_invoice") => {
    if (!detail) return;

    if (documentConversionMode === "prefill_form") {
      const href =
        kind === "quote_to_order"
          ? soCreateFromQuoteHref(detail.id)
          : invoiceCreateFromQuoteHref(detail.id);
      router.push(href);
      return;
    }

    setConversionKind(kind);
    setConversionDialogOpen(true);
  };

  const handleConfirmConversion = () => {
    if (!detail || !conversionKind) return;

    startTransition(async () => {
      setError(null);
      const result =
        conversionKind === "quote_to_order"
          ? await convertQuotationToOrder({ quotation_id: detail.id })
          : await convertQuotationToInvoice({
              quotation_id: detail.id,
              origin_location_id: detail.origin_location_id,
            });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      setConversionDialogOpen(false);
      setConversionKind(null);
      toast.success(
        conversionKind === "quote_to_order" ? "Sales order created." : "Invoice created."
      );

      if (conversionKind === "quote_to_order" && "salesOrderId" in result && result.salesOrderId) {
        router.push(`${SALES_ORDERS_HREF}?id=${encodeURIComponent(result.salesOrderId)}`);
        return;
      }
      if ("salesInvoiceId" in result && result.salesInvoiceId) {
        router.push(`${SALES_INVOICES_HREF}?id=${encodeURIComponent(result.salesInvoiceId)}`);
      }
    });
  };

  const title =
    surface === "create"
      ? "New quote"
      : surface === "edit"
        ? "Edit quote"
        : detail?.quotation_number ?? "Quote";

  const headerActions =
    surface === "peek" && detail ? (
      <>
        {editAccessGranted && canEditSalesDocument(detail.commercial_status) && !detail.sent_at ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Edit quote"
              onClick={() => onOpenEdit?.(detail.id)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {renderWorkflowActions()}
            {detail.commercial_status === "APPROVED_ACTIVE" || detail.sent_at ? (
              <DocumentPrintButton
                moduleKey="SALES_QUOTATION"
                documentId={detail.id}
                documentLocationId={detail.origin_location_id}
                label="Preview PDF"
              />
            ) : null}
          </>
        ) : null}
        {renderConvertActions()}
      </>
    ) : isMutating ? (
      <>
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving…" : "Save draft"}
        </Button>
        {quoteId ? renderWorkflowActions() : null}
      </>
    ) : null;

  const drawerBody = (
    <>
      {error ? <UserFacingErrorMessage message={error} className="mb-4 shrink-0" /> : null}
      {readOnly ? (
        detailLoading ? (
          <p className="text-sm text-muted-foreground">Loading quote…</p>
        ) : detail ? (
          <DocumentPeekActivityShell
            entityType="SALES_QUOTATION"
            entityId={detail.id}
            refreshKey={`${detail.id}:${detail.updated_at}:${detail.sent_at ?? ""}`}
            showApprovalPane={detail.commercial_status === "PENDING_APPROVAL"}
            approvalPane={
              <DocumentPeekApprovalPane
                documentType="SALES_QUOTATION"
                documentId={detail.id}
                documentStatus={detail.commercial_status}
                voucherNumber={detail.quotation_number}
                totalNetAmount={Number(detail.total_net_amount)}
                currencyCode={defaultCurrency}
                approvalSubmittedBy={detail.approval_submitted_by}
                currentUserId={currentUserId}
                isOwner={isOwner}
                approvalSettings={approvalSettings}
                onActionComplete={() => void reloadQuoteDetail(detail.id)}
                onApprove={async () => {
                  const result = await approveSalesQuotation({ quotation_id: detail.id });
                  if ("error" in result) throw new Error(result.error);
                  await reloadQuoteDetail(detail.id);
                  onAfterSave(detail.id);
                }}
                onReject={async (notes) => {
                  const result = await rejectSalesQuotation({
                    quotation_id: detail.id,
                    notes,
                  });
                  if ("error" in result) throw new Error(result.error);
                  await reloadQuoteDetail(detail.id);
                  onAfterSave(detail.id);
                }}
              />
            }
          >
            <div className="space-y-6">
              {draftNextStepHint ? (
                <p className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  {draftNextStepHint}
                </p>
              ) : null}
              <QuotePeekView
                quote={detail}
                layout={documentLayout}
                allowLineItemDiscounts={allowLineItemDiscounts}
                customers={customers}
                locations={locations}
              />
              <SalesDocumentLinkPanel
                documentType="quote"
                documentId={detail.id}
                customerId={detail.customer_id}
                editAccessGranted={editAccessGranted}
                convertedOrder={toSalesDocumentLinkRef(
                  "sales_order",
                  detail.converted_to_order_id,
                  detail.converted_to_order_number
                )}
                convertedInvoice={toSalesDocumentLinkRef(
                  "invoice",
                  detail.converted_to_invoice_id,
                  detail.converted_to_invoice_number
                )}
                onLinked={() => void reloadQuoteDetail(detail.id)}
              />
            </div>
          </DocumentPeekActivityShell>
        ) : (
          <p className="text-sm text-muted-foreground">Quote not found.</p>
        )
      ) : (
        <QuoteDocumentEditorShell
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
          onLinesChange={handleLinesChange}
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
        allowBackgroundInteraction={surface === "peek"}
        className={surface === "peek" ? "module-drawer-peek-shell" : undefined}
        bodyClassName={
          surface === "peek"
            ? "module-drawer-peek-body"
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
            <AlertDialogTitle>Reject {detail?.quotation_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The quote returns to Draft. The submitter can edit and re-submit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quote-reject-notes">Reason</Label>
            <textarea
              id="quote-reject-notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              rows={3}
              placeholder="Explain why this quote cannot be approved…"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={handleReject}>
              Reject quote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {detail?.sent_at ? "Resend quotation" : "Send quotation"}
            </DialogTitle>
            <DialogDescription>
              Email the quotation PDF to your customer, or mark it as sent if you shared it another
              way.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quote-send-email">Recipient email</Label>
              <Input
                id="quote-send-email"
                type="email"
                value={sendToEmail}
                onChange={(event) => setSendToEmail(event.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            {detail ? (
              <DocumentPrintButton
                moduleKey="SALES_QUOTATION"
                documentId={detail.id}
                documentLocationId={detail.origin_location_id}
                label="Preview PDF"
                variant="outline"
              />
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleSendQuotation("MANUAL")}
            >
              Mark as sent
            </Button>
            <Button
              type="button"
              disabled={isPending || !sendToEmail.trim()}
              onClick={() => handleSendQuotation("EMAIL")}
            >
              {isPending ? "Sending…" : detail?.sent_at ? "Resend email" : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SalesDocumentConversionConfirmDialog
        kind={conversionKind}
        open={conversionDialogOpen}
        isPending={isPending}
        onOpenChange={(next) => {
          setConversionDialogOpen(next);
          if (!next) setConversionKind(null);
        }}
        onConfirm={handleConfirmConversion}
      />
    </>
  );
}
